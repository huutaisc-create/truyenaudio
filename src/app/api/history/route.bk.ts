import { NextResponse } from 'next/server';
import db from '@/lib/db';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'webtruyen-secret-key-123456';

export async function GET(req: Request) {
    try {
        const authHeader = req.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split(' ')[1];
        let decoded: any;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch {
            return NextResponse.json({ error: 'Token không hợp lệ' }, { status: 401 });
        }

        const history = await db.readingHistory.findMany({
            where: { userId: decoded.id },
            include: {
                story: {
                    select: {
                        id: true,
                        slug: true,
                        title: true,
                        author: true,
                        coverImage: true,
                    },
                },
                chapter: {
                    select: {
                        id: true,
                        title: true,
                        index: true,
                    },
                },
            },
            orderBy: { visitedAt: 'desc' },
            take: 50,
        });

        return NextResponse.json({
            success: true,
            data: history.map((item) => ({
                storyId: item.storyId,
                slug: item.story.slug,
                title: item.story.title,
                author: item.story.author,
                coverImage: item.story.coverImage,
                chapterId: item.chapterId,
                chapterTitle: item.chapter
                    ? `Chương ${item.chapter.index}: ${item.chapter.title}`
                    : null,
                visitedAt: item.visitedAt,
            })),
        });
    } catch (error) {
        console.error('Get history error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const authHeader = req.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split(' ')[1];
        let decoded: any;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch {
            return NextResponse.json({ error: 'Token không hợp lệ' }, { status: 401 });
        }

        const { storySlug, chapterId } = await req.json();
        if (!storySlug) {
            return NextResponse.json({ error: 'Missing storySlug' }, { status: 400 });
        }

        const story = await db.story.findUnique({
            where: { slug: storySlug },
            select: { id: true },
        });

        if (!story) {
            return NextResponse.json({ error: 'Story not found' }, { status: 404 });
        }

        await db.readingHistory.upsert({
            where: { userId_storyId: { userId: decoded.id, storyId: story.id } },
            update: {
                chapterId: chapterId ?? null,
                visitedAt: new Date(),
            },
            create: {
                userId: decoded.id,
                storyId: story.id,
                chapterId: chapterId ?? null,
            },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Reading history error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
