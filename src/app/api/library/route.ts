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

        const library = await db.library.findMany({
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
            },
            orderBy: { addedAt: 'desc' },
            take: 50,
        });

        return NextResponse.json({
            success: true,
            data: library.map((item) => ({
                storyId: item.storyId,
                slug: item.story.slug,
                title: item.story.title,
                author: item.story.author,
                coverImage: item.story.coverImage,
                addedAt: item.addedAt,
            })),
        });
    } catch (error) {
        console.error('Get library error:', error);
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

        const { storyId } = await req.json();
        if (!storyId) {
            return NextResponse.json({ error: 'Missing storyId' }, { status: 400 });
        }

        const story = await db.story.findUnique({ where: { id: storyId } });
        if (!story) {
            return NextResponse.json({ error: 'Story not found' }, { status: 404 });
        }

        const existing = await db.library.findUnique({
            where: { userId_storyId: { userId: decoded.id, storyId } },
        });

        if (existing) {
            await db.library.delete({
                where: { userId_storyId: { userId: decoded.id, storyId } },
            });
            return NextResponse.json({ bookmarked: false, message: 'Đã xóa khỏi tủ sách' });
        } else {
            await db.library.create({
                data: { userId: decoded.id, storyId },
            });
            return NextResponse.json({ bookmarked: true, message: 'Đã thêm vào tủ sách' });
        }
    } catch (error) {
        console.error('Library toggle error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
