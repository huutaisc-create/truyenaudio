// D:\Webtruyen\webtruyen-app\src\app\api\stories\[slug]\comments\route.ts
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getAuthUser } from '@/lib/auth-helper';
import { rewardCredit } from '@/lib/credits';

const PAGE_SIZE = 20;

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
    if (!content?.trim()) {
      return NextResponse.json({ error: 'Nội dung không được để trống' }, { status: 400 });
    }

    const story = await db.story.findUnique({
      where: { slug },
      select: { id: true, title: true },
    });
    if (!story) return NextResponse.json({ error: 'Story not found' }, { status: 404 });

    // ── Check hết lượt 5 truyện/ngày TRƯỚC khi lưu (chống spam) ──
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

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

    // Đã bình luận truyện này hôm nay → không lưu, trả về thông báo
    const alreadyThisStory = distinctStoryIds.has(story.id);
    if (alreadyThisStory) {
      // Tính giây còn lại tới 0h UTC hôm sau
      const tomorrow = new Date(todayStart);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      const secsUntilMidnight = Math.ceil((tomorrow.getTime() - Date.now()) / 1000);

      return NextResponse.json({
        success: false,
        blocked: true,
        cooldownSeconds: secsUntilMidnight,
        creditMessage: `🔒 Bạn đã bình luận truyện này hôm nay rồi. Quay lại sau 0h nhé!`,
      }, { status: 429 });
    }

    // Đã đủ 5 truyện khác nhau → không lưu
    if (distinctStoryIds.size >= 5) {
      return NextResponse.json({
        success: false,
        blocked: true,
        creditMessage: `🎉 Bạn đã hết lượt bình luận hưởng credit hôm nay rồi, ngày mai quay lại bạn nhé!`,
      }, { status: 429 });
    }

    // ── Lưu bình luận ──
    const comment = await db.comment.create({
      data: {
        content: content.trim(),
        userId: authUser.id,
        storyId: story.id,
      },
      include: {
        user: { select: { id: true, name: true, image: true, role: true } },
      },
    });

    // ── Tính credit ──
    const rewardResult = await rewardCredit(
      authUser.id,
      'REWARD_COMMENT',
      `Bình luận truyện: ${story.title}`,
      {
        content: content.trim(),
        amount: 0.2,
        maxPerDay: 5,
        minLength: 20,
        storyId: story.id,
        cooldownSeconds: 0, // daily lock xử lý ở trên rồi
      }
    );

    // Tính giây tới 0h UTC hôm sau (cho frontend lock truyện này)
    const tomorrow = new Date(todayStart);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const secsUntilMidnight = Math.ceil((tomorrow.getTime() - Date.now()) / 1000);

    let creditMessage: string;
    if (rewardResult.rewarded) {
      const remainingSlots = 5 - (distinctStoryIds.size + 1); // +1 vì vừa dùng 1 slot
      creditMessage = remainingSlots > 0
        ? `✅ Bạn nhận được +0.2 credit · Còn ${remainingSlots} lượt bình luận cho truyện khác hôm nay`
        : `✅ Bạn nhận được +0.2 credit · Đã dùng hết 5 lượt hôm nay 🎉`;
    } else {
      creditMessage = `ℹ️ ${rewardResult.reason}`;
    }

    return NextResponse.json({
      success: true,
      creditMessage,
      cooldownSeconds: secsUntilMidnight, // frontend lock bình luận truyện này tới 0h
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
