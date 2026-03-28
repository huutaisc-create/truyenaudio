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

            // +0.5 credit, tối đa 1 truyện/ngày
            const rewardResult = await rewardCredit(
                userId,
                'REWARD_LIKE',
                `[${storyId}] Yêu thích truyện: ${story?.title ?? storyId}`,
                { amount: 0.5, maxPerDay: 1, minLength: 0, storyId }
            );

            const creditMessage = rewardResult.rewarded
                ? '✅ +0.5 credit cho lượt yêu thích!'
                : `ℹ️ ${rewardResult.reason}`;

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

    // Simple nomination: just create record and increment. 
    // Real world: Limit 1 per day per user? For now, unlimited or just simple check.
    // Let's implement 1 per day restriction check if needed, but for now simple.

    // Check if nominated today?
    // const today = new Date(); 
    // today.setHours(0,0,0,0);
    // const existing = await db.nomination.findFirst({ where: { userId, storyId, createdAt: { gte: today } } });

    const userId = session.user.id;

    try {
        await db.nomination.create({
            data: { userId, storyId }
        });
        await db.story.update({
            where: { id: storyId },
            data: { nominationCount: { increment: 1 } }
        });

        const story = await db.story.findUnique({
            where: { id: storyId },
            select: { title: true },
        });

        // +0.5 credit, tối đa 1 truyện/ngày
        const rewardResult = await rewardCredit(
            userId,
            'REWARD_NOMINATION',
            `[${storyId}] Đề cử truyện: ${story?.title ?? storyId}`,
            { amount: 0.5, maxPerDay: 1, minLength: 0, storyId }
        );

        const creditMessage = rewardResult.rewarded
            ? '✅ +0.5 credit cho lượt đề cử!'
            : `ℹ️ ${rewardResult.reason}`;

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
