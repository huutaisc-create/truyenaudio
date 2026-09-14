// D:\Webtruyen\webtruyen-app\src\app\api\stories\[slug]\comments\route.ts
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getAuthUser } from '@/lib/auth-helper';
import { rewardCredit, getTaskReward } from '@/lib/credits';
import { getVnTodayStart, secsUntilVnMidnight } from '@/lib/date-vn';
import { createNotification } from '@/lib/notify';

const PAGE_SIZE = 20;
const MAX_STORIES_PER_DAY = 5;

// Map 1 comment sang shape trả về; comment đã xoá → tombstone.
function toDto(c: any, isLiked: boolean) {
  const deleted = c.status === 'DELETED';
  return {
    id: c.id,
    parentId: c.parentId ?? null,
    content: deleted ? null : c.content,
    deleted,
    likeCount: c.likeCount,
    replyCount: c.replyCount ?? 0,
    createdAt: c.createdAt,
    isLiked,
    user: deleted ? null : c.user,
  };
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(req.url);
    const after = searchParams.get('after');
    const parentId = searchParams.get('parentId'); // có → lấy REPLY của comment gốc này
    const limit = Math.min(Number(searchParams.get('limit') || PAGE_SIZE), 50);

    const story = await db.story.findUnique({ where: { slug }, select: { id: true } });
    if (!story) return NextResponse.json({ error: 'Story not found' }, { status: 404 });

    const authUser = await getAuthUser(req);

    // commentedToday: chỉ cần cho lần load đầu của comment GỐC
    let commentedToday = false;
    if (authUser && !after && !parentId) {
      const todayStart = getVnTodayStart();
      const tx = await db.creditTransaction.findFirst({
        where: {
          userId: authUser.id,
          type: 'REWARD_COMMENT',
          note: { startsWith: `[story:${story.id}]` },
          createdAt: { gte: todayStart },
        },
        select: { id: true },
      });
      commentedToday = !!tx;
    }

    const comments = await db.comment.findMany({
      where: {
        storyId: story.id,
        // parentId=null → comment GỐC; có parentId → REPLY của comment đó
        parentId: parentId ?? null,
      },
      include: {
        user: { select: { id: true, name: true, image: true, role: true } },
        commentLikes: authUser
          ? { where: { userId: authUser.id }, select: { id: true } }
          : false,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      ...(after && { cursor: { id: after }, skip: 1 }),
    });

    const reversed = comments.reverse();
    return NextResponse.json({
      success: true,
      commentedToday,
      data: reversed.map((c: any) =>
        toDto(c, authUser ? c.commentLikes.length > 0 : false)
      ),
      hasMore: comments.length === limit,
      nextCursor: reversed.length > 0 ? reversed[0].id : null,
    });
  } catch (error) {
    console.error('GET comments error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const authUser = await getAuthUser(req);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const content = body?.content;
    // Chuỗi rỗng cũng phải quy về null: `?? null` chỉ bắt undefined/null, mà ''
    // lọt xuống dưới sẽ bị `if (parentId)` coi là false → reply âm thầm biến thành
    // bình luận gốc, không ai được báo. Đúng triệu chứng đang gặp.
    const rawParentId = body?.parentId;
    const parentId: string | null =
      typeof rawParentId === 'string' && rawParentId.trim() !== '' ? rawParentId.trim() : null;
    const trimmed = content?.trim() ?? '';

    // [LOG TẠM — gỡ sau khi tìm ra vì sao reply mất parentId]
    // In đúng thứ server NHẬN ĐƯỢC: thiếu hẳn khoá, null, chuỗi rỗng hay id thật.
    console.log(
      '[comments POST] parentId nhận được =',
      JSON.stringify(rawParentId),
      '| kiểu:', typeof rawParentId,
      '| các khoá trong body:', Object.keys(body ?? {}).join(',')
    );

    // ── [RULE] Nội dung rỗng / quá ngắn ──
    if (!trimmed) {
      return NextResponse.json({ error: 'Nội dung không được để trống' }, { status: 400 });
    }
    if (trimmed.length <= 20) {
      return NextResponse.json({
        success: false,
        error: 'Bình luận cần ít nhất 21 ký tự để được đăng.',
      }, { status: 400 });
    }

    // (Bỏ chặn cứng cooldown: bình luận luôn được đăng — cooldown 1 phút chỉ áp cho
    //  CREDIT, không chặn đăng. Chống spam: đăng nhập + ≥21 ký tự + SpamKeyword + giới hạn credit.)

    const [story, spamKeywords] = await Promise.all([
      db.story.findUnique({ where: { slug }, select: { id: true, title: true } }),
      db.spamKeyword.findMany({ select: { keyword: true } }),
    ]);
    if (!story) return NextResponse.json({ error: 'Story not found' }, { status: 404 });

    // ── SpamKeyword check ──
    const lowerContent = trimmed.toLowerCase();
    const hitKeyword = spamKeywords.find(k => lowerContent.includes(k.keyword));
    if (hitKeyword) {
      return NextResponse.json({ error: 'Bình luận chứa nội dung không phù hợp.' }, { status: 400 });
    }

    // ── Nếu là REPLY: kiểm tra comment gốc + ép nest 1 cấp ──
    let parentIdToSave: string | null = null;
    let replyRecipientId: string | null = null; // người được reply (nhận thông báo)
    if (parentId) {
      const parent = await db.comment.findUnique({
        where: { id: parentId },
        select: { id: true, parentId: true, status: true, userId: true, storyId: true },
      });
      if (!parent || parent.storyId !== story.id) {
        return NextResponse.json({ error: 'Bình luận gốc không tồn tại' }, { status: 404 });
      }
      if (parent.status !== 'VISIBLE') {
        return NextResponse.json(
          { error: 'Bình luận gốc đã bị xoá hoặc ẩn' },
          { status: 409 }
        );
      }
      // ép nest 1 cấp: reply-của-reply vẫn trỏ về comment GỐC của luồng
      parentIdToSave = parent.parentId ?? parent.id;
      replyRecipientId = parent.userId; // báo cho đúng người mình đang reply
    }

    // ── Tạo comment/reply ──
    const comment = await db.comment.create({
      data: {
        content: trimmed,
        userId: authUser.id,
        storyId: story.id,
        parentId: parentIdToSave,
      },
      include: {
        user: { select: { id: true, name: true, image: true, role: true } },
      },
    });

    const commentData = {
      id: comment.id,
      parentId: comment.parentId ?? null,
      content: comment.content,
      deleted: false,
      likeCount: comment.likeCount,
      replyCount: 0,
      createdAt: comment.createdAt,
      isLiked: false,
      user: comment.user,
    };

    // ── Nếu là REPLY: tăng replyCount gốc + gửi thông báo, KHÔNG tính credit ──
    if (parentIdToSave) {
      await db.comment.update({
        where: { id: parentIdToSave },
        data: { replyCount: { increment: 1 } },
      });
      if (replyRecipientId) {
        await createNotification({
          recipientId: replyRecipientId,
          actorId: authUser.id,
          type: 'COMMENT_REPLY',
          groupKey: `reply:${comment.id}`, // mỗi reply 1 thông báo riêng
          storyId: story.id,
          storySlug: slug,
          commentId: comment.id,
          rootCommentId: parentIdToSave, // thread gốc để app mở + cuộn tới reply
          preview: trimmed.length > 80 ? `${trimmed.slice(0, 80)}…` : trimmed,
        });
      }
      return NextResponse.json({ success: true, credited: false, data: commentData }, { status: 201 });
    }

    // ══════ Dưới đây là COMMENT GỐC → giữ nguyên hệ thống credit cũ ══════
    const todayStart = getVnTodayStart();
    const secsUntilMidnight = secsUntilVnMidnight();

    const txsToday = await db.creditTransaction.findMany({
      where: {
        userId: authUser.id,
        type: 'REWARD_COMMENT',
        note: { startsWith: '[story:' },
        createdAt: { gte: todayStart },
      },
      select: { note: true },
    });

    const distinctStoryIds = new Set(
      txsToday.map((tx, idx) => {
        const match = tx.note?.match(/^\[story:([^\]]+)\]/);
        return match ? match[1] : `__unknown_${idx}`;
      })
    );

    const alreadyThisStory = distinctStoryIds.has(story.id);
    const isOverDailyLimit = distinctStoryIds.size >= MAX_STORIES_PER_DAY;
    const remainingSlots = MAX_STORIES_PER_DAY - distinctStoryIds.size;

    if (alreadyThisStory) {
      const slots = MAX_STORIES_PER_DAY - distinctStoryIds.size;
      return NextResponse.json({
        success: true,
        credited: false,
        remainingSlots: slots,
        creditMessage: slots > 0
          ? `Bình luận đã lưu và không nhận được credit, Còn ${slots} lượt ở truyện khác`
          : `Bình luận đã lưu và không nhận được credit, Hết lượt nhận credit hôm nay rồi`,
        data: commentData,
      }, { status: 201 });
    }

    if (isOverDailyLimit) {
      return NextResponse.json({
        success: true,
        credited: false,
        remainingSlots: 0,
        creditMessage: `Hết lượt nhận credit hôm nay rồi`,
        data: commentData,
      }, { status: 201 });
    }

    const commentReward = await getTaskReward('COMMENT', 0.2);
    const rewardResult = await rewardCredit(
      authUser.id,
      'REWARD_COMMENT',
      `Bình luận truyện: ${story.title}`,
      {
        content: trimmed,
        amount: commentReward,
        maxPerDay: MAX_STORIES_PER_DAY,
        minLength: 21,
        storyId: story.id,
        cooldownSeconds: 0,
      }
    );

    const slotsLeft = remainingSlots - 1;

    let creditMessage: string;
    if (rewardResult.rewarded) {
      creditMessage = slotsLeft > 0
        ? `Bạn nhận được +0.2 credit · Còn ${slotsLeft} lượt ở truyện khác`
        : `Bạn nhận được +0.2 credit · Hết lượt nhận credit hôm nay rồi`;
    } else {
      creditMessage = `Hết lượt nhận credit hôm nay rồi`;
    }

    return NextResponse.json({
      success: true,
      credited: rewardResult.rewarded,
      remainingSlots: rewardResult.rewarded ? Math.max(0, slotsLeft) : 0,
      creditMessage,
      cooldownSeconds: secsUntilMidnight,
      data: commentData,
    }, { status: 201 });
  } catch (error) {
    console.error('POST comment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
