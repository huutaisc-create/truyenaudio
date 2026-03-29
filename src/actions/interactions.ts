"use server";

// D:\Webtruyen\webtruyen-app\src\actions\interactions.ts

import db from "@/lib/db";
import { auth } from "@/auth";
import { rewardCredit } from "@/lib/credits";

const MAX_STORIES_PER_DAY = 5;

export async function toggleFollow(storyId: string) {
  const session = await auth();
  if (!session?.user) return { error: "Bạn cần đăng nhập để thực hiện chức năng này." };

  const userId = session.user.id;

  try {
    const existing = await db.library.findUnique({
      where: { userId_storyId: { userId, storyId } },
    });

    if (existing) {
      await db.library.delete({ where: { id: existing.id } });
      await db.story.update({ where: { id: storyId }, data: { followCount: { decrement: 1 } } });
      return { followed: false };
    } else {
      await db.library.create({ data: { userId, storyId } });
      await db.story.update({ where: { id: storyId }, data: { followCount: { increment: 1 } } });
      return { followed: true };
    }
  } catch (e) {
    console.error(e);
    return { error: "Lỗi hệ thống" };
  }
}

export async function toggleLike(storyId: string) {
  const session = await auth();
  if (!session?.user) return { error: "Bạn cần đăng nhập để thực hiện chức năng này." };

  const userId = session.user.id;

  try {
    const existing = await db.like.findUnique({
      where: { userId_storyId: { userId, storyId } },
    });

    if (existing) {
      await db.$transaction([
        db.like.delete({ where: { id: existing.id } }),
        db.story.update({ where: { id: storyId }, data: { likeCount: { decrement: 1 } } }),
      ]);
      return { liked: false };
    } else {
      await db.$transaction([
        db.like.create({ data: { userId, storyId } }),
        db.story.update({ where: { id: storyId }, data: { likeCount: { increment: 1 } } }),
      ]);
      return { liked: true };
    }
  } catch (e) {
    console.error(e);
    return { error: "Lỗi hệ thống" };
  }
}

// ── Đề cử: max 5 truyện/ngày, +0.2 credit ──
export async function nominateStory(storyId: string) {
  const session = await auth();
  if (!session?.user) return { error: "Bạn cần đăng nhập để thực hiện chức năng này." };

  const userId = session.user.id;

  try {
    const story = await db.story.findUnique({
      where: { id: storyId },
      select: { title: true },
    });

    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const tomorrow = new Date(todayStart);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const secsUntilMidnight = Math.ceil((tomorrow.getTime() - Date.now()) / 1000);

    const txsToday = await db.creditTransaction.findMany({
      where: {
        userId,
        type: 'REWARD_NOMINATION',
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

    const alreadyThisStory = distinctStoryIds.has(storyId);
    const isOverDailyLimit = distinctStoryIds.size >= MAX_STORIES_PER_DAY;
    const remainingSlots = MAX_STORIES_PER_DAY - distinctStoryIds.size;

    // ── [RULE] Đã đề cử truyện này hôm nay → không lưu DB ──
    if (alreadyThisStory) {
      const slotsLeft = MAX_STORIES_PER_DAY - distinctStoryIds.size;
      return {
        success: false,
        blocked: true,
        blockReason: 'SAME_STORY_TODAY',
        cooldownSeconds: secsUntilMidnight,
        // [FIX #1] Thêm remainingSlots field riêng
        remainingSlots: slotsLeft,
        creditMessage: `Hãy quay lại vào ngày mai nhé, bạn còn ${slotsLeft} lượt đề cử cho truyện khác`,
      };
    }

    // ── Lưu nomination record + tăng counter ──
    await db.$transaction([
      db.nomination.create({ data: { userId, storyId } }),
      db.story.update({
        where: { id: storyId },
        data: { nominationCount: { increment: 1 } },
      }),
    ]);

    // ── [RULE] Vượt max 5 truyện → lưu nomination nhưng không credit ──
    if (isOverDailyLimit) {
      return {
        success: true,
        credited: false,
        cooldownSeconds: secsUntilMidnight,
        // [FIX #1] remainingSlots = 0
        remainingSlots: 0,
        creditMessage: `Lượt nhận credit hôm nay của bạn đã hết. Cảm ơn bạn đã đề cử`,
      };
    }

    // ── Tính credit ──
    const rewardResult = await rewardCredit(
      userId,
      'REWARD_NOMINATION',
      `Đề cử truyện: ${story?.title ?? 'Unknown'}`,
      {
        amount: 0.2,
        maxPerDay: MAX_STORIES_PER_DAY,
        minLength: 0,
        storyId,
        cooldownSeconds: 0,
      }
    );

    const slotsLeft = remainingSlots - 1;
    let creditMessage: string;
    if (rewardResult.rewarded) {
      creditMessage = slotsLeft > 0
        ? `Bạn nhận được +0.2 credit · Bạn còn ${slotsLeft} lượt đề cử cho truyện khác`
        : `Bạn nhận được +0.2 credit · Đã dùng hết 5 lượt hôm nay 🎉`;
    } else {
      creditMessage = `Lượt nhận credit hôm nay của bạn đã hết. Cảm ơn bạn đã đề cử`;
    }

    return {
      success: true,
      credited: rewardResult.rewarded,
      // [FIX #1] Thêm remainingSlots field riêng
      remainingSlots: rewardResult.rewarded ? Math.max(0, slotsLeft) : 0,
      creditMessage,
      cooldownSeconds: secsUntilMidnight,
    };
  } catch (e) {
    console.error(e);
    return { error: "Lỗi hệ thống" };
  }
}

export async function getStoryInteractions(storyId: string) {
  const session = await auth();
  const userId = session?.user?.id;

  const story = await db.story.findUnique({
    where: { id: storyId },
    select: {
      followCount: true,
      likeCount: true,
      nominationCount: true,
    },
  });

  let userStatus = {
    isFollowed: false,
    isLiked: false,
    nominationCount: 0,
    lastReadChapterId: null as number | null,
    isNominatedToday: false,
    // [FIX #2] Thêm 2 field mới
    hasReviewed: false,
    commentedToday: false,
  };

  if (userId) {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const [lib, like, history, nominationToday, reviewAllTime, commentedTodayTx] = await Promise.all([
      db.library.findUnique({ where: { userId_storyId: { userId, storyId } } }),
      db.like.findUnique({ where: { userId_storyId: { userId, storyId } } }),
      db.readingHistory.findUnique({
        where: { userId_storyId: { userId, storyId } },
        include: { chapter: { select: { index: true } } },
      }),
      db.nomination.findFirst({
        where: { userId, storyId, createdAt: { gte: todayStart } },
        select: { id: true },
      }),
      // [FIX #2] Check đã review truyện này ALL-TIME (không giới hạn ngày)
      db.review.findFirst({
        where: { userId, storyId },
        select: { id: true },
      }),
      // [FIX #2] Check đã bình luận truyện này HÔM NAY (via credit transaction)
      db.creditTransaction.findFirst({
        where: {
          userId,
          type: 'REWARD_COMMENT',
          note: { startsWith: `[story:${storyId}]` },
          createdAt: { gte: todayStart },
        },
        select: { id: true },
      }),
    ]);

    userStatus.isFollowed = !!lib;
    userStatus.isLiked = !!like;
    userStatus.lastReadChapterId = history?.chapter?.index || null;
    userStatus.isNominatedToday = !!nominationToday;
    userStatus.hasReviewed = !!reviewAllTime;
    userStatus.commentedToday = !!commentedTodayTx;
  }

  return { stats: story, userStatus };
}

export async function getRecentReads(limit = 10) {
  const session = await auth();
  if (!session?.user) return [];

  const history = await db.readingHistory.findMany({
    where: { userId: session.user.id },
    orderBy: { visitedAt: 'desc' },
    take: limit,
    include: {
      story: {
        select: { title: true, slug: true, coverImage: true },
      },
      chapter: {
        select: { index: true },
      },
    },
  });

  return history;
}
