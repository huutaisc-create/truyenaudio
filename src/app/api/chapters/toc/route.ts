import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

const LIMIT = 50;

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const storyId = searchParams.get('storyId');
    const page = parseInt(searchParams.get('page') || '1', 10);

    if (!storyId) {
        return NextResponse.json({ success: false, message: 'storyId is required' }, { status: 400 });
    }

    const offset = (page - 1) * LIMIT;

    try {
        const [chapters, total] = await Promise.all([
            db.chapter.findMany({
                where: { storyId },
                orderBy: { index: 'asc' },
                take: LIMIT,
                skip: offset,
                select: { id: true, index: true, title: true },
            }),
            db.chapter.count({ where: { storyId } }),
        ]);

        return NextResponse.json({
            success: true,
            data: {
                chapters,
                page,
                total,
                hasMore: offset + chapters.length < total,
            },
        });
    } catch (error) {
        console.error('TOC API Error:', error);
        return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
    }
}
