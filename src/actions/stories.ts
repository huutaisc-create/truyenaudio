'use server'

import db from '@/lib/db'
import { Prisma } from '@prisma/client'
import { unstable_cache, revalidatePath } from 'next/cache'

export type SearchParams = {
    keyword?: string
    genres?: string[]
    boiCanh?: string[]
    luuPhai?: string[]
    tinhCach?: string[]
    thiGiac?: string[]
    status?: string[]
    minChapters?: number
    maxChapters?: number
    sortBy?: string
    page?: number
    month?: number
    year?: number
}

import { auth } from '@/auth';
import { rewardCredit } from '@/lib/credits';
import { getVnTodayStart, secsUntilVnMidnight } from '@/lib/date-vn';

export async function searchStories(params: SearchParams) {
    const {
        keyword, genres, boiCanh, luuPhai, tinhCach, thiGiac,
        status, minChapters, maxChapters, sortBy = 'hot',
        page = 1, month, year
    } = params
    const limit = 24
    const offset = (page - 1) * limit

    const where: Prisma.StoryWhereInput = { isHidden: false }

    if (keyword) {
        const kw = `%${keyword.trim()}%`
        const matchingIds = await db.$queryRaw<{ id: string }[]>(
            Prisma.sql`
                SELECT id FROM "Story"
                WHERE "isHidden" = false
                  AND unaccent(lower(title)) ILIKE unaccent(lower(${kw}))
            `
        )
        const ids = matchingIds.map(r => r.id)
        where.id = { in: ids.length > 0 ? ids : ['__no_match__'] }
    }

    const andConditions: Prisma.StoryWhereInput[] = []

    if (genres && genres.length > 0) {
        andConditions.push(...genres.map(g => ({
            genres: { some: { name: { contains: g }, type: 'GENRE' } }
        })))
    }
    if (boiCanh && boiCanh.length > 0) {
        andConditions.push(...boiCanh.map(b => ({
            genres: { some: { name: { contains: b }, type: 'BOI_CANH' } }
        })))
    }
    if (luuPhai && luuPhai.length > 0) {
        andConditions.push(...luuPhai.map(l => ({
            genres: { some: { name: { contains: l }, type: 'LUU_PHAI' } }
        })))
    }
    if (tinhCach && tinhCach.length > 0) {
        andConditions.push(...tinhCach.map(t => ({
            genres: { some: { name: { contains: t }, type: 'TINH_CACH' } }
        })))
    }
    if (thiGiac && thiGiac.length > 0) {
        andConditions.push(...thiGiac.map(t => ({
            genres: { some: { name: { contains: t }, type: 'THI_GIAC' } }
        })))
    }

    if (andConditions.length > 0) {
        where.AND = andConditions
    }

    if (status && status.length > 0) {
        const statusMap: Record<string, string> = {
            "Đang Ra":    "ONGOING",
            "Hoàn Thành": "COMPLETED",
            "Dịch":       "TRANSLATED",
            "Convert":    "CONVERTED",
        }
        const dbStatuses = status.map(s => statusMap[s] || s)
        where.status = { in: dbStatuses }
    }

    if (minChapters !== undefined || maxChapters !== undefined) {
        const currentFilter = (typeof where.totalChapters === 'object' ? where.totalChapters : {}) as Prisma.IntFilter
        if (minChapters !== undefined) currentFilter.gte = minChapters
        if (maxChapters !== undefined) currentFilter.lte = maxChapters
        where.totalChapters = currentFilter
    }

    if (month && year) {
        const from = new Date(year, month - 1, 1)
        const to   = new Date(year, month, 1)
        where.updatedAt = { gte: from, lt: to }
    }

    let orderBy: Prisma.StoryOrderByWithRelationInput = { viewCount: 'desc' }
    switch (sortBy) {
        case 'Mới Cập Nhật': case 'new': orderBy = { updatedAt: 'desc' }; break
        case 'Đề Cử': case 'rating': orderBy = { ratingScore: 'desc' }; break
        case 'Đánh Giá': orderBy = { ratingScore: 'desc' }; break
        default: orderBy = { viewCount: 'desc' }
    }

    try {
        // FIX PERF: dùng select thay include — chỉ lấy field cần thiết
        const [stories, total] = await Promise.all([
            db.story.findMany({
                where,
                orderBy,
                take: limit,
                skip: offset,
                select: {
                    id: true,
                    title: true,
                    slug: true,
                    coverImage: true,
                    author: true,
                    status: true,
                    viewCount: true,
                    ratingScore: true,
                    ratingCount: true,
                    totalChapters: true,
                    genres: {
                        // FIX PERF: chỉ lấy field cần, giới hạn số genre
                        select: { name: true, type: true },
                        take: 3,
                    },
                    _count: { select: { chapters: true } }
                }
            }),
            db.story.count({ where })
        ])

        return {
            data: stories.map((s: any) => ({
                ...s,
                chapterCount: s._count.chapters
            })),
            pagination: {
                total,
                page,
                totalPages: Math.ceil(total / limit)
            }
        }
    } catch (error) {
        console.error("Search Error:", error)
        return { data: [], pagination: { total: 0, page: 1, totalPages: 0 } }
    }
}

// Cache getStoryBySlug 60 giây, dùng per-slug tag để invalidate đúng truyện sau khi submit review
function getCachedStory(slug: string) {
    return unstable_cache(
        async () => {
            return db.story.findUnique({
                where: { slug },
                select: {
                    id: true,
                    title: true,
                    slug: true,
                    coverImage: true,
                    author: true,
                    status: true,
                    viewCount: true,
                    likeCount: true,
                    followCount: true,
                    nominationCount: true,
                    ratingScore: true,
                    ratingCount: true,
                    description: true,
                    totalChapters: true,
                    genres: { select: { name: true, type: true } },
                    chapters: {
                        orderBy: { index: 'desc' },
                        take: 5,
                        select: { id: true, index: true, title: true, updatedAt: true },
                    },
                    storyType: true,
                    translatorName: true,
                    sourceUrl: true,
                    isCompleted: true,
                    // reviews fetch riêng trong page.tsx (không cache) → luôn fresh
                    _count: { select: { chapters: true } },
                },
            });
        },
        [`story-${slug}`],
        { revalidate: 60, tags: ['story', `story-${slug}`] }
    )();
}

export async function getStoryBySlug(slug: string) {
    try {
        return await getCachedStory(slug)
    } catch (error) {
        console.error("Get Story Error:", error)
        return null
    }
}

// FIX PERF: Cache danh sách chương — ít thay đổi, cache lâu hơn
const getCachedChapters = unstable_cache(
    async (storyId: string, page: number) => {
        const limit = 50
        const offset = (page - 1) * limit
        const [chapters, total] = await Promise.all([
            db.chapter.findMany({
                where: { storyId },
                orderBy: { index: 'asc' },
                take: limit,
                skip: offset,
                select: { id: true, index: true, title: true, updatedAt: true }
            }),
            db.chapter.count({ where: { storyId } })
        ])
        return {
            chapters,
            total,
            totalPages: Math.ceil(total / limit),
            currentPage: page
        }
    },
    ['chapters-by-story'],
    { revalidate: 300 } // 5 phút — chương ít thay đổi hơn
)

export async function getChaptersByStoryId(storyId: string, page: number = 1) {
    try {
        return await getCachedChapters(storyId, page)
    } catch (error) {
        console.error("Get Chapters Error:", error)
        return { chapters: [], total: 0, totalPages: 0, currentPage: 1 }
    }
}

// FIX PERF: Cache related stories 5 phút
const getCachedRelated = unstable_cache(
    async (storyId: string, genreNames: string[], limit: number) => {
        return db.story.findMany({
            where: {
                isHidden: false,
                id: { not: storyId },
                genres: { some: { name: { in: genreNames } } }
            },
            orderBy: { viewCount: 'desc' },
            take: limit,
            select: {
                id: true,
                title: true,
                slug: true,
                coverImage: true,
                author: true,
                status: true,
                _count: { select: { chapters: true } },
                genres: { select: { name: true }, take: 2 }
            }
        })
    },
    ['related-stories'],
    { revalidate: 300 }
)

export async function getRelatedStories(storyId: string, genreNames: string[], limit: number = 5) {
    try {
        return await getCachedRelated(storyId, genreNames, limit)
    } catch (error) {
        console.error("Get Related Stories Error:", error)
        return []
    }
}

// FIX PERF: Cache author stories 5 phút
const getCachedAuthorStories = unstable_cache(
    async (author: string, storyId: string, limit: number) => {
        return db.story.findMany({
            where: { isHidden: false, author, id: { not: storyId } },
            orderBy: { viewCount: 'desc' },
            take: limit,
            select: {
                id: true,
                title: true,
                slug: true,
                coverImage: true,
                status: true,
                _count: { select: { chapters: true } }
            }
        })
    },
    ['author-stories'],
    { revalidate: 300 }
)

export async function getStoriesByAuthor(author: string, storyId: string, limit: number = 4) {
    try {
        return await getCachedAuthorStories(author, storyId, limit)
    } catch (error) {
        console.error("Get Author Stories Error:", error)
        return []
    }
}

export async function getChapterBySlugAndIndex(slug: string, index: number) {
    try {
        const story = await db.story.findUnique({
            where: { slug },
            select: { id: true, title: true, coverImage: true }
        });
        if (!story) return null;

        const chapter = await db.chapter.findFirst({
            where: { storyId: story.id, index },
        });
        if (!chapter) return null;

        // FIX PERF: view count + prev/next chạy song song
        const [, , prev, next] = await Promise.all([
            db.story.update({
                where: { id: story.id },
                data: { viewCount: { increment: 1 } }
            }).catch(e => console.error("Failed to increment story view", e)),
            db.chapter.update({
                where: { id: chapter.id },
                data: { viewCount: { increment: 1 } }
            }).catch(e => console.error("Failed to increment chapter view", e)),
            db.chapter.findFirst({
                where: { storyId: story.id, index: { lt: index } },
                orderBy: { index: 'desc' },
                select: { index: true }
            }),
            db.chapter.findFirst({
                where: { storyId: story.id, index: { gt: index } },
                orderBy: { index: 'asc' },
                select: { index: true }
            })
        ]);

        return {
            storyTitle: story.title,
            storyCover: story.coverImage,
            chapter,
            prev: prev ? prev.index : null,
            next: next ? next.index : null
        };
    } catch (error) {
        console.error("Get Chapter Error:", error);
        return null;
    }
}

export async function updateChapterContent(chapterId: string, newContent: string) {
    const session = await auth();
    if (!session || session.user.role !== 'ADMIN') {
        return { success: false, error: 'Unauthorized' };
    }

    try {
        const chapter = await db.chapter.findUnique({
            where: { id: chapterId },
            include: { story: { select: { slug: true } } }
        });
        if (!chapter) return { success: false, error: 'Chapter not found' };

        const { writeFile, mkdir } = await import('fs/promises');
        const chaptersRoot = process.env.CHAPTERS_STORAGE_PATH!;
        const dir = `${chaptersRoot}/${chapter.story.slug}`;
        await mkdir(dir, { recursive: true });
        await writeFile(`${dir}/${chapter.index}.txt`, newContent, 'utf-8');

        const contentUrl = `/chapters/${chapter.story.slug}/${chapter.index}.txt`;
        await db.chapter.update({
            where: { id: chapterId },
            data: { contentUrl }
        });
        return { success: true };
    } catch (error) {
        console.error("Update Chapter Content Error:", error);
        return { success: false, error: 'Failed to update content' };
    }
}

export async function submitReview(storyId: string, rating: number, content: string) {
  const session = await auth();
  if (!session || !session.user) {
    return { success: false, error: 'Bạn cần đăng nhập để đánh giá.' };
  }

  const userId = session.user.id;
  const MAX_STORIES_PER_DAY = 5;

  try {
    const story = await db.story.findUnique({
      where: { id: storyId },
      select: { title: true, slug: true, ratingScore: true, ratingCount: true },
    });

    const todayStart = getVnTodayStart();
    const secsUntilMidnight = secsUntilVnMidnight();

    // ── [FIX Bug 1] Check đã review all-time (không giới hạn theo ngày) ──
    const alreadyReviewed = await db.review.findFirst({
      where: { userId, storyId },
      select: { id: true },
    });
    if (alreadyReviewed) {
      return {
        success: false,
        blocked: true,
        blockReason: 'SAME_STORY_TODAY',
        cooldownSeconds: secsUntilMidnight,
        error: `Bạn đã đánh giá truyện này rồi.`,
      };
    }

    const txsToday = await db.creditTransaction.findMany({
      where: {
        userId,
        type: 'REWARD_REVIEW',
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

    const isOverDailyLimit = distinctStoryIds.size >= MAX_STORIES_PER_DAY;
    const remainingSlots = MAX_STORIES_PER_DAY - distinctStoryIds.size;

    // ── Lưu review + cập nhật rating (tất cả trường hợp còn lại đều lưu) ──
    await db.$transaction(async (tx) => {
      await tx.review.create({
        data: { userId, storyId, rating, content },
      });
      if (story) {
        const currentScore = story.ratingScore ?? 0;
        const currentCount = story.ratingCount || 0;
        const newCount = currentCount + 1;
        const newScore = ((currentScore * currentCount) + rating) / newCount;
        await tx.story.update({
          where: { id: storyId },
          data: {
            ratingCount: newCount,
            ratingScore: parseFloat(newScore.toFixed(2)),
          },
        });
      }
    });

    // Invalidate cache của truyện này → ratingScore/ratingCount fresh sau khi refresh
    if (story?.slug) {
        revalidatePath(`/truyen/${story.slug}`, 'page');
    }

    // ── [RULE] Vượt max 5 truyện → lưu review nhưng không credit ──
    if (isOverDailyLimit) {
      return {
        success: true,
        credited: false,
        cooldownSeconds: secsUntilMidnight,
        creditMessage: `Lượt nhận credit hôm nay của bạn đã hết. Cảm ơn bạn đã đánh giá`,
      };
    }

    // ── Tính credit ──
    const trimmedContent = content?.trim() ?? '';
    const rewardResult = await rewardCredit(
      userId,
      'REWARD_REVIEW',
      `Đánh giá truyện: ${story?.title ?? 'Unknown'}`,
      {
        content: trimmedContent,
        amount: 0.2,
        maxPerDay: MAX_STORIES_PER_DAY,
        minLength: 21,
        storyId,
        cooldownSeconds: 0,
      }
    );

    let creditMessage: string;
    if (rewardResult.rewarded) {
      const slotsLeft = remainingSlots - 1;
      creditMessage = slotsLeft > 0
        ? `Bạn nhận được +0.2 credit · Bạn còn ${slotsLeft} lượt đánh giá cho truyện khác`
        : `Bạn nhận được +0.2 credit · Đã dùng hết 5 lượt hôm nay 🎉`;
    } else {
      creditMessage = trimmedContent.length <= 20
        ? `Đánh giá đã lưu · Cần hơn 20 ký tự để nhận credit`
        : `Lượt nhận credit hôm nay của bạn đã hết. Cảm ơn bạn đã đánh giá`;
    }

    return {
      success: true,
      credited: rewardResult.rewarded,
      creditMessage,
      cooldownSeconds: secsUntilMidnight,
    };
  } catch (error) {
    console.error('Submit Review Error:', error);
    return { success: false, error: 'Lỗi hệ thống, vui lòng thử lại sau.' };
  }
}

export async function trackChapterRead(storySlug: string, chapterId: string) {
    const session = await auth();
    if (!session?.user?.id) return;

    const userId = session.user.id;

    // FIX PERF: 2 query này chạy tuần tự — cần tìm story trước
    const story = await db.story.findUnique({
        where: { slug: storySlug },
        select: { id: true },
    });
    if (!story) return;

    const existing = await db.readingHistory.findUnique({
        where: { userId_storyId: { userId, storyId: story.id } },
        select: { chapterId: true },
    });

    const isNewChapter = existing?.chapterId !== chapterId;

    // FIX PERF: upsert + update user chạy song song nếu là chương mới
    if (isNewChapter || !existing) {
        await Promise.all([
            db.readingHistory.upsert({
                where: { userId_storyId: { userId, storyId: story.id } },
                update: { chapterId, visitedAt: new Date() },
                create: { userId, storyId: story.id, chapterId },
            }),
            db.user.update({
                where: { id: userId },
                data: { chaptersRead: { increment: 1 } },
            })
        ])
    } else {
        await db.readingHistory.upsert({
            where: { userId_storyId: { userId, storyId: story.id } },
            update: { chapterId, visitedAt: new Date() },
            create: { userId, storyId: story.id, chapterId },
        })
    }
}

// ── Top Đề Cử sidebar ─────────────────────────────────────────────────────
// Query đồng bộ với trang chủ (nominationCount desc, include genres take 1)
// → Prisma/Next.js cache dedup: cùng query shape → không hit DB 2 lần
const getCachedTopNominations = unstable_cache(
    async (limit: number) => {
        return db.story.findMany({
            take: limit,
            where: { isHidden: false },
            orderBy: { nominationCount: 'desc' },
            include: { genres: { take: 1 } },
        })
    },
    ['top-nominations'],
    { revalidate: 300 }
)

export async function getTopNominations(limit: number = 5) {
    try {
        return await getCachedTopNominations(limit)
    } catch (error) {
        console.error("Get Top Nominations Error:", error)
        return []
    }
}
