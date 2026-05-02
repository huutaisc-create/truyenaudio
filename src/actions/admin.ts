'use server'

import db from '@/lib/db'
import { auth } from '@/auth'
import { revalidatePath } from 'next/cache'
import { ALL_ADMIN_ROLES } from '@/lib/admin-guard'
import { fetchChapterContent } from '@/lib/chapterContent'

async function checkAdmin() {
    const session = await auth()
    if (!session?.user || !ALL_ADMIN_ROLES.includes(session.user.role as any)) {
        throw new Error('Unauthorised')
    }
    return session
}

// ── Local disk helpers (dynamic import để Turbopack không scan) ───────────
async function saveChapterToDisk(slug: string, index: number, content: string): Promise<string> {
    const { writeFile, mkdir } = await import('fs/promises')
    const root = process.env.CHAPTERS_STORAGE_PATH!
    const dir = `${root}/${slug}`
    await mkdir(dir, { recursive: true })
    await writeFile(`${dir}/${index}.txt`, content, 'utf-8')
    return `/chapters/${slug}/${index}.txt`
}

async function getManifestPath(): Promise<string> {
    const root = process.env.CHAPTERS_STORAGE_PATH!
    return `${root}/../models/custom/manifest.json`
}

export async function getDashboardStats() {
    await checkAdmin();

    const now = Date.now();
    const VN_OFFSET_MS = 7 * 3600 * 1000;
    const vnNow = now + VN_OFFSET_MS;
    const todayStartUtc = new Date(Math.floor(vnNow / 86400000) * 86400000 - VN_OFFSET_MS);
    const last7Days = new Date(now - 7 * 86400000);

    const [
        storyCount,
        userCount,
        chapterCount,
        newUsersToday,
        creditIssued,
        creditConsumed,
        activeUsersTodayRaw,
        topStoriesRaw,
        recentTransactions,
    ] = await Promise.all([
        db.story.count({ where: { isHidden: false } }),
        db.user.count(),
        db.chapter.count(),

        // User mới đăng ký hôm nay (VN midnight)
        db.user.count({ where: { createdAt: { gte: todayStartUtc } } }),

        // Credit phát ra hôm nay (amount > 0)
        db.creditTransaction.aggregate({
            where: { amount: { gt: 0 }, createdAt: { gte: todayStartUtc } },
            _sum: { amount: true },
        }),

        // Credit tiêu thụ hôm nay (amount < 0)
        db.creditTransaction.aggregate({
            where: { amount: { lt: 0 }, createdAt: { gte: todayStartUtc } },
            _sum: { amount: true },
        }),

        // User active hôm nay (có ReadingHistory)
        db.readingHistory.groupBy({
            by: ['userId'],
            where: { visitedAt: { gte: todayStartUtc } },
        }),

        // Top 5 truyện được nghe nhiều nhất 7 ngày qua
        db.readingHistory.groupBy({
            by: ['storyId'],
            where: { visitedAt: { gte: last7Days } },
            _count: { storyId: true },
            orderBy: { _count: { storyId: 'desc' } },
            take: 5,
        }),

        // 10 giao dịch credit gần nhất
        db.creditTransaction.findMany({
            take: 10,
            orderBy: { createdAt: 'desc' },
            include: {
                user: { select: { name: true, email: true } },
            },
        }),
    ]);

    // Lấy tên truyện cho top stories
    const storyIds = topStoriesRaw.map(r => r.storyId);
    const topStoryDetails = await db.story.findMany({
        where: { id: { in: storyIds } },
        select: { id: true, title: true, slug: true, coverImage: true },
    });
    const storyMap = Object.fromEntries(topStoryDetails.map(s => [s.id, s]));

    const topStories = topStoriesRaw.map(r => ({
        storyId: r.storyId,
        count: r._count.storyId,
        story: storyMap[r.storyId] ?? null,
    }));

    return {
        stories:           storyCount,
        users:             userCount,
        chapters:          chapterCount,
        newUsersToday,
        activeUsersToday:  activeUsersTodayRaw.length,
        creditIssued:      Math.round((creditIssued._sum.amount ?? 0) * 100) / 100,
        creditConsumed:    Math.round(Math.abs(creditConsumed._sum.amount ?? 0) * 100) / 100,
        topStories,
        recentTransactions,
    };
}

// --- STORY ACTIONS ---

export async function createStory(formData: FormData) {
    const session = await checkAdmin();

    const title = formData.get('title') as string;
    const author = formData.get('author') as string;
    const description = formData.get('description') as string;
    const coverImage = formData.get('coverImage') as string;
    const status = formData.get('status') as string;
    const selectedGenres = formData.getAll('genres') as string[];
    const viewCount = parseInt(formData.get('viewCount') as string || '0');
    const ratingScore = parseFloat(formData.get('ratingScore') as string || '0');
    const ratingCount = parseInt(formData.get('ratingCount') as string || '0');
    const storyType = (formData.get('storyType') as string) || 'ORIGINAL';
    const isHidden = formData.get('isHidden') === 'on';
    const isCompleted = formData.get('isCompleted') === 'on';
    const translatorName = (formData.get('translatorName') as string) || null;
    const sourceUrl = (formData.get('sourceUrl') as string) || null;

    if (!title || !author) {
        return { error: "Missing required fields" };
    }

    const slug = title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    try {
        const existingStory = await db.story.findUnique({ where: { slug } });
        const finalSlug = existingStory ? `${slug}-${Date.now()}` : slug;

        const genreConnect = selectedGenres.map(gName => ({
            where: { name_type: { name: gName, type: 'GENRE' } },
            create: { name: gName, type: 'GENRE' }
        }));

        const newStory = await db.story.create({
            data: {
                title,
                slug: finalSlug,
                author,
                description,
                coverImage,
                status,
                viewCount,
                ratingScore,
                ratingCount,
                storyType,
                isHidden,
                isCompleted,
                translatorName: translatorName || undefined,
                sourceUrl: sourceUrl || undefined,
                genres: {
                    connectOrCreate: genreConnect
                }
            }
        });

        return { success: true, id: newStory.id };
    } catch (error) {
        console.error("Create Story Error:", error);
        return { error: "Failed to create story" };
    }
}

export async function updateStory(id: string, formData: FormData) {
    await checkAdmin();

    const title = formData.get('title') as string;
    const author = formData.get('author') as string;
    const description = formData.get('description') as string;
    const coverImage = formData.get('coverImage') as string;
    const status = formData.get('status') as string;
    const selectedGenres = formData.getAll('genres') as string[];
    const viewCount = parseInt(formData.get('viewCount') as string || '0');
    const ratingScore = parseFloat(formData.get('ratingScore') as string || '0');
    const ratingCount = parseInt(formData.get('ratingCount') as string || '0');
    const storyType = (formData.get('storyType') as string) || 'ORIGINAL';
    const isHidden = formData.get('isHidden') === 'on';
    const isCompleted = formData.get('isCompleted') === 'on';
    const translatorName = (formData.get('translatorName') as string) || null;
    const sourceUrl = (formData.get('sourceUrl') as string) || null;

    try {
        await db.story.update({
            where: { id },
            data: { genres: { set: [] } }
        });

        const genreConnect = selectedGenres.map(gName => ({
            where: { name_type: { name: gName, type: 'GENRE' } },
            create: { name: gName, type: 'GENRE' }
        }));

        await db.story.update({
            where: { id },
            data: {
                title,
                author,
                description,
                coverImage,
                status,
                viewCount,
                ratingScore,
                ratingCount,
                storyType,
                isHidden,
                isCompleted,
                translatorName: translatorName || null,
                sourceUrl: sourceUrl || null,
                genres: {
                    connectOrCreate: genreConnect
                }
            }
        });

        revalidatePath(`/admin/stories/${id}`);
        return { success: true };
    } catch (error) {
        console.error("Update Story Error:", error);
        return { error: "Failed to update story" };
    }
}

export async function deleteStory(id: string) {
    const session = await checkAdmin();
    try {
        const story = await db.story.findUnique({ where: { id }, select: { title: true, slug: true } });
        await db.story.delete({ where: { id } });

        // Xóa file trên disk
        if (story?.slug) {
            const { rm } = await import('fs/promises');
            const chaptersRoot = process.env.CHAPTERS_STORAGE_PATH!;
            const uploadRoot = process.env.UPLOAD_STORAGE_DIR!;
            await rm(`${chaptersRoot}/${story.slug}`, { recursive: true, force: true });
            await rm(`${uploadRoot}/covers/${story.slug}.webp`, { force: true });
        }

        await db.adminLog.create({ data: {
            adminId: session.user.id!,
            action: 'DELETE_STORY',
            targetType: 'STORY',
            targetId: id,
            detail: story?.title ?? id,
        }}).catch(() => {});
        return { success: true };
    } catch (error) {
        console.error("Delete Story Error:", error);
        return { error: "Failed to delete story" };
    }
}

export async function getStories(query?: string, page = 1, storyType?: string, showHidden?: boolean) {
    await checkAdmin();
    const take = 20;
    const skip = (page - 1) * take;

    const conditions: any[] = [];

    if (query) {
        conditions.push({
            OR: [
                { title: { contains: query, mode: 'insensitive' } },
                { author: { contains: query, mode: 'insensitive' } }
            ]
        });
    }
    if (storyType) conditions.push({ storyType });
    // showHidden=true → hiện cả ẩn; false/undefined → chỉ hiện ẩn
    if (showHidden) conditions.push({ isHidden: true });

    const where = conditions.length > 0 ? { AND: conditions } : {};

    const [stories, total] = await Promise.all([
        db.story.findMany({
            where,
            orderBy: { updatedAt: 'desc' },
            take,
            skip,
            include: { _count: { select: { chapters: true } } }
        }),
        db.story.count({ where })
    ]);

    return { stories, total, totalPages: Math.ceil(total / take) };
}

export async function toggleStoryHidden(storyId: string, hide: boolean) {
    await checkAdmin()
    await db.story.update({ where: { id: storyId }, data: { isHidden: hide } })
    revalidatePath('/admin/stories')
    revalidatePath('/')
}

export async function toggleFeaturedStory(storyId: string, feature: boolean) {
    await checkAdmin()
    if (feature) {
        // Tính featuredOrder = max hiện tại + 1
        const agg = await db.story.aggregate({ _max: { featuredOrder: true } })
        const nextOrder = (agg._max.featuredOrder ?? 0) + 1
        await db.story.update({ where: { id: storyId }, data: { isFeatured: true, featuredOrder: nextOrder } })
    } else {
        await db.story.update({ where: { id: storyId }, data: { isFeatured: false, featuredOrder: 0 } })
    }
    revalidatePath('/admin/stories')
    revalidatePath('/')
}

// --- CHAPTER ACTIONS ---

export async function createChapter(storyId: string, formData: FormData) {
    await checkAdmin();

    const title = formData.get('title') as string;
    const content = formData.get('content') as string;
    const indexStr = formData.get('index') as string;

    if (!title || !content || !indexStr) {
        return { error: "Missing required fields" };
    }

    const index = parseInt(indexStr);

    try {
        const story = await db.story.findUnique({
            where: { id: storyId },
            select: { slug: true }
        });

        if (!story) return { error: "Story not found" };

        const contentUrl = await saveChapterToDisk(story.slug, index, content);

        const newChapter = await db.chapter.create({
            data: {
                title,
                contentUrl,
                index,
                storyId
            }
        });

        await db.story.update({
            where: { id: storyId },
            data: {
                totalChapters: { increment: 1 },
                updatedAt: new Date()
            }
        });

        return { success: true, id: newChapter.id };
    } catch (error) {
        console.error("Create Chapter Error:", error);
        return { error: "Failed to create chapter" };
    }
}

export async function updateChapter(chapterId: string, formData: FormData) {
    await checkAdmin();

    const title = formData.get('title') as string;
    const content = formData.get('content') as string;
    const indexStr = formData.get('index') as string;

    if (!title || !content || !indexStr) {
        return { error: "Missing required fields" };
    }

    const index = parseInt(indexStr);

    try {
        const chapter = await db.chapter.findUnique({
            where: { id: chapterId },
            include: { story: { select: { slug: true } } }
        });

        if (!chapter) return { error: "Chapter not found" };

        const contentUrl = await saveChapterToDisk(chapter.story.slug, index, content);

        await db.chapter.update({
            where: { id: chapterId },
            data: {
                title,
                contentUrl,
                index
            }
        });

        return { success: true };
    } catch (error) {
        console.error("Update Chapter Error:", error);
        return { error: "Failed to update chapter" };
    }
}

export async function deleteChapter(chapterId: string, storyId: string) {
    await checkAdmin();
    try {
        await db.chapter.delete({ where: { id: chapterId } });

        await db.story.update({
            where: { id: storyId },
            data: { totalChapters: { decrement: 1 } }
        });

        return { success: true };
    } catch (error) {
        console.error("Delete Chapter Error:", error);
        return { error: "Failed to delete chapter" };
    }
}

export async function getChapters(storyId: string) {
    await checkAdmin();
    const chapters = await db.chapter.findMany({
        where: { storyId },
        orderBy: { index: 'desc' }
    });

    return chapters;
}

export async function getNextChapterIndex(storyId: string) {
    await checkAdmin();
    const latest = await db.chapter.findFirst({
        where: { storyId },
        orderBy: { index: 'desc' },
        select: { index: true }
    });
    return (latest?.index || 0) + 1;
}

// --- USER ACTIONS ---

export async function getUsers(query?: string, page = 1, role?: string) {
    await checkAdmin();
    const take = 20;
    const skip = (page - 1) * take;

    const conditions: any[] = [];
    if (query) {
        conditions.push({
            OR: [
                { name: { contains: query, mode: 'insensitive' } },
                { email: { contains: query, mode: 'insensitive' } },
            ],
        });
    }
    if (role) conditions.push({ role });
    const where = conditions.length > 0 ? { AND: conditions } : {};

    const [users, total] = await Promise.all([
        db.user.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take,
            skip,
            select: {
                id: true,
                name: true,
                email: true,
                image: true,
                role: true,
                downloadCredits: true,
                chaptersRead: true,
                currentStreak: true,
                createdAt: true,
            },
        }),
        db.user.count({ where }),
    ]);

    return { users, total, totalPages: Math.ceil(total / take) };
}

export async function getUserDetail(id: string) {
    await checkAdmin();

    const [user, creditTxs, history, reviews, comments] = await Promise.all([
        db.user.findUnique({
            where: { id },
            include: {
                userVips: {
                    orderBy: { endAt: 'desc' },
                    take: 1,
                    include: { plan: { select: { name: true } } },
                },
            },
        }),
        db.creditTransaction.findMany({
            where: { userId: id },
            orderBy: { createdAt: 'desc' },
            take: 30,
        }),
        db.readingHistory.findMany({
            where: { userId: id },
            orderBy: { visitedAt: 'desc' },
            take: 20,
            include: { story: { select: { id: true, title: true, coverImage: true, slug: true } } },
        }),
        db.review.findMany({
            where: { userId: id },
            orderBy: { createdAt: 'desc' },
            take: 10,
            include: { story: { select: { title: true } } },
        }),
        db.comment.findMany({
            where: { userId: id },
            orderBy: { createdAt: 'desc' },
            take: 10,
            include: { story: { select: { title: true } } },
        }),
    ]);

    return { user, creditTxs, history, reviews, comments };
}

export async function updateUserRole(id: string, role: string) {
    const session = await checkAdmin();
    if (session.user.role !== 'ADMIN') return { error: 'Không đủ quyền' };

    try {
        const user = await db.user.findUnique({ where: { id }, select: { role: true, email: true } });
        await db.user.update({ where: { id }, data: { role } });
        await db.adminLog.create({ data: {
            adminId: session.user.id!,
            action: 'CHANGE_ROLE',
            targetType: 'USER',
            targetId: id,
            detail: `${user?.email}: ${user?.role} → ${role}`,
        }}).catch(() => {});
        return { success: true };
    } catch (e) {
        return { error: 'Cập nhật thất bại' };
    }
}

export async function adjustUserCredit(id: string, amount: number, note: string) {
    const session = await checkAdmin();

    try {
        const user = await db.user.findUnique({ where: { id }, select: { downloadCredits: true } });
        if (!user) return { error: 'User không tồn tại' };

        const newBalance = Math.max(0, user.downloadCredits + amount);

        await db.$transaction([
            db.user.update({
                where: { id },
                data: { downloadCredits: newBalance },
            }),
            db.creditTransaction.create({
                data: {
                    userId: id,
                    type: 'ADD_WEB',
                    amount,
                    balanceAfter: newBalance,
                    note: note || `Admin điều chỉnh: ${amount > 0 ? '+' : ''}${amount}`,
                },
            }),
        ]);

        await db.adminLog.create({ data: {
            adminId: session.user.id!,
            action: 'ADJUST_CREDIT',
            targetType: 'USER',
            targetId: id,
            detail: `${amount > 0 ? '+' : ''}${amount} | ${note} | sau: ${newBalance.toFixed(1)}`,
        }}).catch(() => {});
        return { success: true, newBalance };
    } catch (e) {
        console.error(e);
        return { error: 'Điều chỉnh thất bại' };
    }
}

// --- ECONOMY: CREDIT TRANSACTIONS ---

export async function getCreditTransactions(query?: string, page = 1, type?: string) {
    await checkAdmin();
    const take = 30;
    const skip = (page - 1) * take;

    const conditions: any[] = [];
    if (query) {
        conditions.push({
            user: {
                OR: [
                    { name: { contains: query, mode: 'insensitive' } },
                    { email: { contains: query, mode: 'insensitive' } },
                ],
            },
        });
    }
    if (type) conditions.push({ type });
    const where = conditions.length > 0 ? { AND: conditions } : {};

    const [txs, total] = await Promise.all([
        db.creditTransaction.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take,
            skip,
            include: { user: { select: { id: true, name: true, email: true, image: true } } },
        }),
        db.creditTransaction.count({ where }),
    ]);

    return { txs, total, totalPages: Math.ceil(total / take) };
}

// --- ECONOMY: VIP PLANS ---

export async function getVipPlans() {
    await checkAdmin();
    return db.vipPlan.findMany({ orderBy: { sortOrder: 'asc' } });
}

export async function createVipPlan(formData: FormData) {
    await checkAdmin();
    try {
        const benefits = {
            noAds: formData.get('noAds') === 'on',
            offlineUnlimited: formData.get('offlineUnlimited') === 'on',
            premiumVoices: formData.get('premiumVoices') === 'on',
        };
        await db.vipPlan.create({
            data: {
                name: formData.get('name') as string,
                price: parseInt(formData.get('price') as string),
                durationDays: parseInt(formData.get('durationDays') as string),
                benefits,
                isActive: formData.get('isActive') === 'on',
                sortOrder: parseInt(formData.get('sortOrder') as string || '0'),
            },
        });
        revalidatePath('/admin/economy/vip-plans');
        return { success: true };
    } catch (e) {
        console.error(e);
        return { error: 'Tạo gói thất bại' };
    }
}

export async function updateVipPlan(id: string, formData: FormData) {
    await checkAdmin();
    try {
        const benefits = {
            noAds: formData.get('noAds') === 'on',
            offlineUnlimited: formData.get('offlineUnlimited') === 'on',
            premiumVoices: formData.get('premiumVoices') === 'on',
        };
        await db.vipPlan.update({
            where: { id },
            data: {
                name: formData.get('name') as string,
                price: parseInt(formData.get('price') as string),
                durationDays: parseInt(formData.get('durationDays') as string),
                benefits,
                isActive: formData.get('isActive') === 'on',
                sortOrder: parseInt(formData.get('sortOrder') as string || '0'),
            },
        });
        revalidatePath('/admin/economy/vip-plans');
        return { success: true };
    } catch (e) {
        return { error: 'Cập nhật thất bại' };
    }
}

export async function deleteVipPlan(id: string) {
    await checkAdmin();
    try {
        await db.vipPlan.delete({ where: { id } });
        revalidatePath('/admin/economy/vip-plans');
        return { success: true };
    } catch (e) {
        return { error: 'Xoá thất bại' };
    }
}

// --- ECONOMY: DAILY TASKS ---

export async function getDailyTasks() {
    await checkAdmin();
    return db.dailyTaskConfig.findMany({ orderBy: { taskKey: 'asc' } });
}

export async function upsertDailyTask(taskKey: string, label: string, description: string, creditReward: number, isActive: boolean) {
    await checkAdmin();
    await db.dailyTaskConfig.upsert({
        where: { taskKey },
        update: { label, description, creditReward, isActive },
        create: { taskKey, label, description, creditReward, isActive },
    });
    revalidatePath('/admin/economy/daily-tasks');
    return { success: true };
}

// --- MODERATION: COMMENTS ---

export async function getComments(query?: string, page = 1) {
    await checkAdmin();
    const take = 30;
    const skip = (page - 1) * take;

    const where = query ? {
        OR: [
            { content: { contains: query, mode: 'insensitive' as const } },
            { user: { name: { contains: query, mode: 'insensitive' as const } } },
        ],
    } : {};

    const [comments, total] = await Promise.all([
        db.comment.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take,
            skip,
            include: {
                user: { select: { id: true, name: true, email: true } },
                story: { select: { id: true, title: true } },
            },
        }),
        db.comment.count({ where }),
    ]);

    return { comments, total, totalPages: Math.ceil(total / take) };
}

export async function deleteComment(id: string) {
    const session = await checkAdmin();
    try {
        const c = await db.comment.findUnique({ where: { id }, select: { content: true, userId: true } });
        await db.comment.delete({ where: { id } });
        await db.adminLog.create({ data: {
            adminId: session.user.id!,
            action: 'DELETE_COMMENT',
            targetType: 'COMMENT',
            targetId: id,
            detail: c?.content?.slice(0, 100),
        }}).catch(() => {});
        return { success: true };
    } catch (e) {
        return { error: 'Xoá thất bại' };
    }
}

// --- MODERATION: REVIEWS ---

export async function getReviews(query?: string, page = 1) {
    await checkAdmin();
    const take = 30;
    const skip = (page - 1) * take;

    const where = query ? {
        OR: [
            { content: { contains: query, mode: 'insensitive' as const } },
            { user: { name: { contains: query, mode: 'insensitive' as const } } },
        ],
    } : {};

    const [reviews, total] = await Promise.all([
        db.review.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take,
            skip,
            include: {
                user: { select: { id: true, name: true, email: true } },
                story: { select: { id: true, title: true } },
            },
        }),
        db.review.count({ where }),
    ]);

    return { reviews, total, totalPages: Math.ceil(total / take) };
}

export async function deleteReview(id: string) {
    const session = await checkAdmin();
    try {
        const r = await db.review.findUnique({ where: { id }, select: { content: true, rating: true } });
        await db.review.delete({ where: { id } });
        await db.adminLog.create({ data: {
            adminId: session.user.id!,
            action: 'DELETE_REVIEW',
            targetType: 'REVIEW',
            targetId: id,
            detail: `[${r?.rating}/10] ${r?.content?.slice(0, 80)}`,
        }}).catch(() => {});
        return { success: true };
    } catch (e) {
        return { error: 'Xoá thất bại' };
    }
}

// --- MODERATION: SPAM KEYWORDS ---

export async function getSpamKeywords() {
    await checkAdmin();
    return db.spamKeyword.findMany({ orderBy: { createdAt: 'desc' } });
}

export async function addSpamKeyword(keyword: string) {
    const session = await checkAdmin();
    if (!keyword.trim()) return { error: 'Từ khoá trống' };
    try {
        await db.spamKeyword.create({
            data: { keyword: keyword.trim().toLowerCase(), createdBy: session?.user?.id ?? 'admin' },
        });
        revalidatePath('/admin/moderation/keywords');
        return { success: true };
    } catch (e: any) {
        if (e?.code === 'P2002') return { error: 'Từ khoá đã tồn tại' };
        return { error: 'Thêm thất bại' };
    }
}

export async function deleteSpamKeyword(id: string) {
    await checkAdmin();
    try {
        await db.spamKeyword.delete({ where: { id } });
        revalidatePath('/admin/moderation/keywords');
        return { success: true };
    } catch (e) {
        return { error: 'Xoá thất bại' };
    }
}

// --- ADMIN LOGS ---

export async function getAdminLogs(page = 1, action?: string) {
    await checkAdmin();
    const take = 30;
    const skip = (page - 1) * take;

    const where = action ? { action } : {};

    const [logs, total] = await Promise.all([
        db.adminLog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take,
            skip,
            include: { admin: { select: { id: true, name: true, email: true } } },
        }),
        db.adminLog.count({ where }),
    ]);

    return { logs, total, totalPages: Math.ceil(total / take) };
}

// --- PUSH NOTIFICATIONS ---

export async function getPushNotifications(page = 1) {
    await checkAdmin();
    const take = 20;
    const skip = (page - 1) * take;

    const [notifs, total] = await Promise.all([
        db.pushNotification.findMany({
            orderBy: { createdAt: 'desc' },
            take,
            skip,
        }),
        db.pushNotification.count(),
    ]);

    return { notifs, total, totalPages: Math.ceil(total / take) };
}

export async function createPushNotification(formData: FormData) {
    const session = await checkAdmin();

    const title = formData.get('title') as string;
    const body = formData.get('body') as string;
    const targetType = formData.get('targetType') as string;

    if (!title || !body) return { error: 'Thiếu tiêu đề hoặc nội dung' };

    try {
        const notif = await db.pushNotification.create({
            data: {
                title,
                body,
                targetType: targetType || 'ALL',
                status: 'DRAFT',
                createdBy: session.user.id ?? '',
            },
        });
        revalidatePath('/admin/notifications');
        return { success: true, id: notif.id };
    } catch (e) {
        return { error: 'Tạo thông báo thất bại' };
    }
}

// --- VOICES (local manifest) ---

export async function getVoiceManifest(): Promise<{ id: string; name: string; path?: string }[]> {
    await checkAdmin();
    try {
        const { readFile } = await import('fs/promises')
        const manifestPath = await getManifestPath()
        const body = await readFile(manifestPath, 'utf-8')
        return JSON.parse(body)
    } catch (e: any) {
        if (e?.code === 'ENOENT') return [];
        console.error('getVoiceManifest error:', e);
        return [];
    }
}

export async function saveVoiceManifest(voices: { id: string; name: string; path?: string }[]) {
    await checkAdmin();
    const { writeFile, mkdir } = await import('fs/promises')
    const manifestPath = await getManifestPath()
    // Tạo thư mục nếu chưa có (dùng template để tránh path.dirname)
    const dir = manifestPath.replace(/\/[^/]+$/, '')
    await mkdir(dir, { recursive: true })
    await writeFile(manifestPath, JSON.stringify(voices, null, 2), 'utf-8')
    revalidatePath('/admin/voices');
    return { success: true };
}

// --- BULK FIND & REPLACE ---

export async function searchInStoryChapters(storyId: string, searchText: string) {
    await checkAdmin();
    if (!storyId || !searchText.trim()) return { error: 'Thiếu storyId hoặc từ khoá' };

    const chapters = await db.chapter.findMany({
        where: { storyId },
        orderBy: { index: 'asc' },
        select: { id: true, title: true, index: true, contentUrl: true },
    });

    const results: { id: string; title: string; index: number; matchCount: number; preview: string }[] = [];

    for (const ch of chapters) {
        if (!ch.contentUrl) continue;
        try {
            const text = await fetchChapterContent(ch.contentUrl);
            if (!text) continue;
            const regex = new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
            const matches = text.match(regex);
            if (matches && matches.length > 0) {
                // Preview: lấy đoạn đầu tiên có match
                const idx = text.toLowerCase().indexOf(searchText.toLowerCase());
                const start = Math.max(0, idx - 40);
                const end = Math.min(text.length, idx + searchText.length + 40);
                const preview = (start > 0 ? '...' : '') + text.slice(start, end) + (end < text.length ? '...' : '');
                results.push({ id: ch.id, title: ch.title, index: ch.index, matchCount: matches.length, preview });
            }
        } catch (e) {
            // skip chapter nếu lỗi
        }
    }

    return { results, totalChapters: chapters.length };
}

export async function replaceInStoryChapters(storyId: string, searchText: string, replaceText: string) {
    await checkAdmin();
    if (!storyId || !searchText.trim()) return { error: 'Thiếu tham số' };

    const story = await db.story.findUnique({ where: { id: storyId }, select: { slug: true } });
    if (!story) return { error: 'Truyện không tồn tại' };

    const chapters = await db.chapter.findMany({
        where: { storyId },
        orderBy: { index: 'asc' },
        select: { id: true, title: true, index: true, contentUrl: true },
    });

    let replaced = 0;
    const chaptersRoot = process.env.CHAPTERS_STORAGE_PATH!;

    for (const ch of chapters) {
        if (!ch.contentUrl) continue;
        try {
            const original = await fetchChapterContent(ch.contentUrl);
            if (!original) continue;
            const regex = new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
            if (!regex.test(original)) continue;

            const updated = original.replace(regex, replaceText);

            // Ghi thẳng vào file local (dynamic import tránh Turbopack scan)
            const { writeFile, mkdir } = await import('fs/promises')
            const relativePath = ch.contentUrl.startsWith('/chapters/')
                ? ch.contentUrl.slice('/chapters/'.length)
                : ch.contentUrl;
            const filePath = `${chaptersRoot}/${relativePath}`;
            const fileDir = filePath.replace(/\/[^/]+$/, '')
            await mkdir(fileDir, { recursive: true });
            await writeFile(filePath, updated, 'utf-8');
            replaced++;
        } catch (e) {
            console.error(`replaceInChapter ${ch.id}:`, e);
        }
    }

    return { success: true, replaced };
}

// --- STORY REQUESTS ---

export async function getStoryRequests(page = 1, status?: string) {
    await checkAdmin();
    const take = 25;
    const skip = (page - 1) * take;
    const where = status ? { status } : {};

    const [requests, total] = await Promise.all([
        db.storyRequest.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take,
            skip,
            include: {
                user: { select: { id: true, name: true, email: true } },
                story: { select: { id: true, title: true, slug: true } },
            },
        }),
        db.storyRequest.count({ where }),
    ]);

    return { requests, total, totalPages: Math.ceil(total / take) };
}

export async function updateStoryRequest(id: string, status: string, storyId?: string) {
    const session = await checkAdmin();
    try {
        await db.storyRequest.update({
            where: { id },
            data: {
                status,
                ...(storyId ? { storyId } : {}),
            },
        });
        await db.adminLog.create({ data: {
            adminId: session.user.id!,
            action: 'UPDATE_REQUEST',
            targetType: 'STORY_REQUEST',
            targetId: id,
            detail: `status → ${status}${storyId ? ` | storyId: ${storyId}` : ''}`,
        }}).catch(() => {});
        revalidatePath('/admin/requests');
        return { success: true };
    } catch (e) {
        return { error: 'Cập nhật thất bại' };
    }
}
