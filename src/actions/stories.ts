'use server'

import db from '@/lib/db'
import { Prisma } from '@prisma/client'

export type SearchParams = {
    keyword?: string
    genres?: string[]     // type: GENRE
    boiCanh?: string[]    // type: BOI_CANH
    luuPhai?: string[]    // type: LUU_PHAI
    tinhCach?: string[]   // type: TINH_CACH
    thiGiac?: string[]    // type: THI_GIAC
    status?: string[]
    minChapters?: number
    maxChapters?: number
    sortBy?: string
    page?: number
    month?: number
    year?: number
}

import { auth } from '@/auth';

export async function searchStories(params: SearchParams) {
    const {
        keyword, genres, boiCanh, luuPhai, tinhCach, thiGiac,
        status, minChapters, maxChapters, sortBy = 'hot',
        page = 1, month, year
    } = params
    const limit = 24
    const offset = (page - 1) * limit

    const where: Prisma.StoryWhereInput = {}

    // Keyword search — SQLite không hỗ trợ mode:'insensitive'
    // Dùng cả lowercase để simulate case-insensitive
    if (keyword) {
        const kw = keyword.toLowerCase()
        where.OR = [
            { title:  { contains: keyword } },
            { title:  { contains: kw } },
            { author: { contains: keyword } },
            { author: { contains: kw } },
        ]
    }

    // Gom tất cả tag filters thành AND conditions — mỗi tag phải đúng type
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

    // Status filter
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

    // Chapter range filter
    if (minChapters !== undefined || maxChapters !== undefined) {
        const currentFilter = (typeof where.totalChapters === 'object' ? where.totalChapters : {}) as Prisma.IntFilter
        if (minChapters !== undefined) currentFilter.gte = minChapters
        if (maxChapters !== undefined) currentFilter.lte = maxChapters
        where.totalChapters = currentFilter
    }

    // Time filter
    if (month && year) {
        const from = new Date(year, month - 1, 1)
        const to   = new Date(year, month, 1)
        where.updatedAt = { gte: from, lt: to }
    }

    let orderBy: Prisma.StoryOrderByWithRelationInput = { viewCount: 'desc' }

    switch (sortBy) {
        case 'Mới Cập Nhật':
        case 'new':
            orderBy = { updatedAt: 'desc' }
            break
        case 'Đề Cử':
        case 'rating':
            orderBy = { ratingScore: 'desc' }
            break
        case 'Lượt Xem':
        case 'views':
        case 'hot':
            orderBy = { viewCount: 'desc' }
            break
        case 'Đánh Giá':
            orderBy = { ratingScore: 'desc' }
            break
        default:
            orderBy = { viewCount: 'desc' }
    }

    try {
        const stories = await db.story.findMany({
            where,
            orderBy,
            take: limit,
            skip: offset,
            include: {
                genres: true,
                _count: { select: { chapters: true } }
            }
        })

        const total = await db.story.count({ where })

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

export async function getStoryBySlug(slug: string) {
    try {
        const story = await db.story.findUnique({
            where: { slug },
            include: {
                genres: true,
                chapters: {
                    orderBy: { index: 'desc' },
                    take: 5,
                    select: {
                        id: true,
                        index: true,
                        title: true,
                        updatedAt: true,
                    }
                },
                reviews: {
                    orderBy: { createdAt: 'desc' },
                    take: 10,
                    include: {
                        user: {
                            select: {
                                name: true,
                                image: true
                            }
                        }
                    }
                },
                _count: {
                    select: { chapters: true }
                }
            }
        })

        return story
    } catch (error) {
        console.error("Get Story Error:", error)
        return null
    }
}

// Lấy danh sách chương theo trang (50 chương/trang, sắp xếp tăng dần)
export async function getChaptersByStoryId(storyId: string, page: number = 1) {
    const limit = 50
    const offset = (page - 1) * limit

    try {
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
    } catch (error) {
        console.error("Get Chapters Error:", error)
        return { chapters: [], total: 0, totalPages: 0, currentPage: 1 }
    }
}

// Lấy truyện cùng thể loại (trừ truyện hiện tại)
export async function getRelatedStories(storyId: string, genreNames: string[], limit: number = 5) {
    try {
        const stories = await db.story.findMany({
            where: {
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
        return stories
    } catch (error) {
        console.error("Get Related Stories Error:", error)
        return []
    }
}

// Lấy truyện khác cùng tác giả (trừ truyện hiện tại)
export async function getStoriesByAuthor(author: string, storyId: string, limit: number = 4) {
    try {
        const stories = await db.story.findMany({
            where: {
                author,
                id: { not: storyId }
            },
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
        return stories
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

        try {
            await Promise.all([
                db.story.update({
                    where: { id: story.id },
                    data: { viewCount: { increment: 1 } }
                }),
                db.chapter.update({
                    where: { id: chapter.id },
                    data: { viewCount: { increment: 1 } }
                })
            ]);
        } catch (e) {
            console.error("Failed to increment view count", e);
        }

        const [prev, next] = await Promise.all([
            db.chapter.findFirst({
                where: { storyId: story.id, index: index - 1 },
                select: { index: true }
            }),
            db.chapter.findFirst({
                where: { storyId: story.id, index: index + 1 },
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
        // Lấy thông tin chapter + story slug để upload R2
        const chapter = await db.chapter.findUnique({
            where: { id: chapterId },
            include: { story: { select: { slug: true } } }
        });

        if (!chapter) return { success: false, error: 'Chapter not found' };

        // Upload content lên R2
        const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
        const s3 = new S3Client({
            region: 'auto',
            endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
            credentials: {
                accessKeyId: process.env.R2_ACCESS_KEY_ID!,
                secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
            },
        });

        const key = `chapters/${chapter.story.slug}/${chapter.index}.txt`;
        await s3.send(new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME!,
            Key: key,
            Body: Buffer.from(newContent, 'utf-8'),
            ContentType: 'text/plain; charset=utf-8',
        }));

        const contentUrl = `${process.env.R2_PUBLIC_URL}/${key}`;

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
        return { success: false, error: "Bạn cần đăng nhập để đánh giá." };
    }

    try {
        await db.$transaction(async (tx) => {
            await tx.review.create({
                data: {
                    userId: session.user.id,
                    storyId: storyId,
                    rating: rating,
                    content: content
                }
            });

            const story = await tx.story.findUnique({
                where: { id: storyId },
                select: { ratingScore: true, ratingCount: true }
            });

            if (story) {
                const currentScore = story.ratingScore || 5.0;
                const currentCount = story.ratingCount || 0;
                const newCount = currentCount + 1;
                const newScore = ((currentScore * currentCount) + rating) / newCount;

                await tx.story.update({
                    where: { id: storyId },
                    data: {
                        ratingCount: newCount,
                        ratingScore: parseFloat(newScore.toFixed(2))
                    }
                });
            }
        });

        return { success: true };
    } catch (error) {
        console.error("Submit Review Error:", error);
        return { success: false, error: "Lỗi hệ thống, vui lòng thử lại sau." };
    }
}

export async function trackChapterRead(storySlug: string, chapterId: string) {
    const session = await auth();
    if (!session?.user?.id) return;

    const userId = session.user.id;

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

    await db.readingHistory.upsert({
        where: { userId_storyId: { userId, storyId: story.id } },
        update: { chapterId, visitedAt: new Date() },
        create: { userId, storyId: story.id, chapterId },
    });

    if (isNewChapter || !existing) {
        await db.user.update({
            where: { id: userId },
            data: { chaptersRead: { increment: 1 } },
        });
    }
}
