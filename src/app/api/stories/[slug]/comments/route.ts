// D:\Webtruyen\webtruyen-app\src\app\api\stories\[slug]\comments\route.ts
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getAuthUser } from '@/lib/auth-helper';
import { rewardCredit } from '@/lib/credits';

const PAGE_SIZE = 20;
const MAX_STORIES_PER_DAY = 5;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(req.url);
    const after = searchParams.get('after');
    const limit = Math.min(Number(searchParams.get('limit') || PAGE_SIZE), 50);

    const story = await db.story.findUnique({ where: { slug }, select: { id: true } });
    if (!story) return NextResponse.json({ error: 'Story not found' }, { status: 404 });

    const authUser = await getAuthUser(req);

    const comments = await db.comment.findMany({
      where: { storyId: story.id },
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
      data: reversed.map(c => ({
        id: c.id,
        content: c.content,
        likeCount: c.likeCount,
        createdAt: c.createdAt,
        isLiked: authUser ? c.commentLikes.length > 0 : false,
        user: c.user,
      })),
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

    const { content } = await req.json();
    const trimmed = content?.trim() ?? '';

    // ── [RULE] Nội dung rỗng → reject ──
    if (!trimmed) {
      return NextResponse.json({ error: 'Nội dung không được để trống' }, { status: 400 });
    }

    // ── [RULE] Nội dung <= 20 ký tự → không lưu DB ──
    if (trimmed.length <= 20) {
      return NextResponse.json({
        success: false,
        error: 'Bình luận cần ít nhất 21 ký tự để được đăng.',
      }, { status: 400 });
    }

    const story = await db.story.findUnique({
      where: { slug },
      select: { id: true, title: true },
    });
    if (!story) return NextResponse.json({ error: 'Story not found' }, { status: 404 });

    // ── Lấy lịch sử credit hôm nay ──
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const tomorrow = new Date(todayStart);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const secsUntilMidnight = Math.ceil((tomorrow.getTime() - Date.now()) / 1000);

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
    const remainingSlots = MAX_STORIES_PER_DAY - distinctStoryIds.size; // trước khi dùng slot này

    // ── [RULE] Đã bình luận truyện này hôm nay → không lưu DB ──
    if (alreadyThisStory) {
      // Số slot còn lại (không tính truyện này vì đã dùng)
      const slotsLeft = MAX_STORIES_PER_DAY - distinctStoryIds.size;
      return NextResponse.json({
        success: false,
        blocked: true,
        blockReason: 'SAME_STORY_TODAY',
        cooldownSeconds: secsUntilMidnight,
        // [FIX #1] Thêm remainingSlots field riêng
        remainingSlots: slotsLeft,
        creditMessage: `Hãy quay lại vào ngày mai nhé, bạn còn ${slotsLeft} lượt bình luận cho truyện khác`,
      }, { status: 429 });
    }

    // ── Lưu bình luận ──
    const comment = await db.comment.create({
      data: {
        content: trimmed,
        userId: authUser.id,
        storyId: story.id,
      },
      include: {
        user: { select: { id: true, name: true, image: true, role: true } },
      },
    });

    // ── [RULE] Vượt max 5 truyện → lưu comment nhưng không credit ──
    if (isOverDailyLimit) {
      return NextResponse.json({
        success: true,
        credited: false,
        cooldownSeconds: secsUntilMidnight,
        // [FIX #1] remainingSlots = 0 vì đã hết
        remainingSlots: 0,
        creditMessage: `Lượt nhận credit hôm nay của bạn đã hết. Cảm ơn bạn đã bình luận`,
        data: {
          id: comment.id,
          content: comment.content,
          likeCount: comment.likeCount,
          createdAt: comment.createdAt,
          isLiked: false,
          user: comment.user,
        },
      }, { status: 201 });
    }

    // ── Tính credit ──
    const rewardResult = await rewardCredit(
      authUser.id,
      'REWARD_COMMENT',
      `Bình luận truyện: ${story.title}`,
      {
        content: trimmed,
        amount: 0.2,
        maxPerDay: MAX_STORIES_PER_DAY,
        minLength: 21,
        storyId: story.id,
        cooldownSeconds: 0,
      }
    );

    // remainingSlots - 1 vì vừa dùng slot này
    const slotsLeft = remainingSlots - 1;

    let creditMessage: string;
    if (rewardResult.rewarded) {
      creditMessage = slotsLeft > 0
        ? `Bạn nhận được +0.2 credit · Bạn còn ${slotsLeft} lượt bình luận cho truyện khác`
        : `Bạn nhận được +0.2 credit · Đã dùng hết 5 lượt hôm nay 🎉`;
    } else {
      creditMessage = `Lượt nhận credit hôm nay của bạn đã hết. Cảm ơn bạn đã bình luận`;
    }

    return NextResponse.json({
      success: true,
      credited: rewardResult.rewarded,
      // [FIX #1] Thêm remainingSlots field riêng, frontend dùng thẳng số này
      remainingSlots: rewardResult.rewarded ? Math.max(0, slotsLeft) : 0,
      creditMessage,
      cooldownSeconds: secsUntilMidnight,
      data: {
        id: comment.id,
        content: comment.content,
        likeCount: comment.likeCount,
        createdAt: comment.createdAt,
        isLiked: false,
        user: comment.user,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('POST comment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
