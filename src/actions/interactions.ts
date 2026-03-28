"use server";

// D:\Webtruyen\webtruyen-app\src\actions\interactions.ts

import db from "@/lib/db";
import { auth } from "@/auth";
import { rewardCredit } from "@/lib/credits";

export async function toggleFollow(storyId: string) {
    const session = await auth();
    if (!session?.user) return { error: "Bạn cần đăng nhập để thực hiện chức năng này." };

    const userId = session.user.id;

    try {
        const existing = await db.library.findUnique({
            where: { userId_storyId: { userId, storyId } }
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
            where: { userId_storyId: { userId, storyId } }
        });

        if (existing) {
            // Bỏ like — không trừ credit
            await db.like.delete({ where: { id: existing.id } });
            await db.story.update({ where: { id: storyId }, data: { likeCount: { decrement: 1 } } });
            return { liked: false, creditMessage: null };
        } else {
            // Like mới
            await db.like.create({ data: { userId, storyId } });
            await db.story.update({ where: { id: storyId }, data: { likeCount: { increment: 1 } } });

            const story = await db.story.findUnique({
                where: { id: storyId },
                select: { title: true },
            });

            // +0.5 credit, tối đa 1 truyện/ngày, note thân thiện (không có storyId raw)
            const rewardResult = await rewardCredit(
                userId,
                'REWARD_LIKE',
                `Yêu thích truyện: ${story?.title ?? 'Unknown'}`,
                { amount: 0.5, maxPerDay: 1, minLength: 0, storyId }
            );

            let creditMessage: string
            if (rewardResult.rewarded) {
                const usable = rewardResult.usable
                creditMessage = `✅ Bạn vừa cộng được +0.5 credit · Còn ${usable} lượt tải`
            } else {
                // Đã dùng hết lượt yêu thích hôm nay
                creditMessage = `ℹ️ Đã dùng hết lượt yêu thích hôm nay`
            }

            return { liked: true, creditMessage };
        }
    } catch (e) {
        console.error(e);
        return { error: "Lỗi hệ thống" };
    }
}

export async function nominateStory(storyId: string) {
    const session = await auth();
    if (!session?.user) return { error: "Bạn cần đăng nhập để thực hiện chức năng này." };

    const userId = session.user.id;

    try {
        const story = await db.story.findUnique({
            where: { id: storyId },
            select: { title: true },
        });

        // BUG FIX: Check đã đề cử và đã nhận thưởng hôm nay TRƯỚC khi tạo record
        // để tránh inflate nominationCount
        const todayStart = new Date()
        todayStart.setUTCHours(0, 0, 0, 0)

        const alreadyNominatedToday = await db.creditTransaction.findFirst({
            where: {
                userId,
                type: 'REWARD_NOMINATION',
                note: { startsWith: `[story:${storyId}]` },
                createdAt: { gte: todayStart },
            },
        })

        if (alreadyNominatedToday) {
            return {
                success: false,
                creditMessage: `ℹ️ Đã dùng hết lượt đề cử hôm nay`,
            }
        }

        // Tạo nomination record và tăng counter
        await db.nomination.create({ data: { userId, storyId } });
        await db.story.update({
            where: { id: storyId },
            data: { nominationCount: { increment: 1 } }
        });

        // +0.5 credit, tối đa 1 truyện/ngày, note thân thiện
        const rewardResult = await rewardCredit(
            userId,
            'REWARD_NOMINATION',
            `Đề cử truyện: ${story?.title ?? 'Unknown'}`,
            { amount: 0.5, maxPerDay: 1, minLength: 0, storyId }
        );

        let creditMessage: string
        if (rewardResult.rewarded) {
            const usable = rewardResult.usable
            creditMessage = `✅ Bạn vừa cộng được +0.5 credit · Còn ${usable} lượt tải`
        } else {
            creditMessage = `ℹ️ Đã dùng hết lượt đề cử hôm nay`
        }

        return { success: true, creditMessage };
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
        }
    });

    let userStatus = {
        isFollowed: false,
        isLiked: false,
        nominationCount: 0,
        lastReadChapterId: null as number | null
    };

    if (userId) {
        const [lib, like, history] = await Promise.all([
            db.library.findUnique({ where: { userId_storyId: { userId, storyId } } }),
            db.like.findUnique({ where: { userId_storyId: { userId, storyId } } }),
            db.readingHistory.findUnique({
                where: { userId_storyId: { userId, storyId } },
                include: { chapter: { select: { index: true } } }
            })
        ]);
        userStatus.isFollowed = !!lib;
        userStatus.isLiked = !!like;
        userStatus.lastReadChapterId = history?.chapter?.index || null;
    }

    return {
        stats: story,
        userStatus
    };
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
                select: {
                    title: true,
                    slug: true,
                    coverImage: true,
                }
            },
            chapter: {
                select: {
                    index: true
                }
            }
        }
    });

    return history;
}
