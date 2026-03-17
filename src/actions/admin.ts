'use server'

import db from '@/lib/db'
import { auth } from '@/auth'
import { revalidatePath } from 'next/cache'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

async function checkAdmin() {
    const session = await auth()
    if (!session || session.user.role !== 'ADMIN') {
        if (session?.user.role !== 'ADMIN') {
            // console.warn("Accessing admin without explicit ADMIN role")
        }
        return session
    }
    return session
}

// ── R2 client ────────────────────────────────────────────
const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
})

async function uploadChapterToR2(slug: string, index: number, content: string): Promise<string> {
    const key = `chapters/${slug}/${index}.txt`
    await s3.send(new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: key,
        Body: Buffer.from(content, 'utf-8'),
        ContentType: 'text/plain; charset=utf-8',
    }))
    return `${process.env.R2_PUBLIC_URL}/${key}`
}

export async function getDashboardStats() {
    await checkAdmin();

    const [storyCount, userCount, chapterCount] = await Promise.all([
        db.story.count(),
        db.user.count(),
        db.chapter.count(),
    ])

    return {
        stories: storyCount,
        users: userCount,
        chapters: chapterCount
    }
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
    await checkAdmin();
    try {
        await db.story.delete({ where: { id } });
        return { success: true };
    } catch (error) {
        console.error("Delete Story Error:", error);
        return { error: "Failed to delete story" };
    }
}

export async function getStories(query?: string, page = 1) {
    await checkAdmin();
    const take = 20;
    const skip = (page - 1) * take;

    const where = query ? {
        OR: [
            { title: { contains: query } },
            { author: { contains: query } }
        ]
    } : {};

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
        // Lấy slug của story để tạo đường dẫn R2
        const story = await db.story.findUnique({
            where: { id: storyId },
            select: { slug: true }
        });

        if (!story) return { error: "Story not found" };

        // Upload content lên R2
        const contentUrl = await uploadChapterToR2(story.slug, index, content);

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
        // Lấy story slug để upload R2
        const chapter = await db.chapter.findUnique({
            where: { id: chapterId },
            include: { story: { select: { slug: true } } }
        });

        if (!chapter) return { error: "Chapter not found" };

        // Upload content mới lên R2
        const contentUrl = await uploadChapterToR2(chapter.story.slug, index, content);

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
