import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { auth } from '@/auth';

export async function GET(req: Request, { params }: { params: Promise<{ storySlug: string }> }) {
    try {
        const { storySlug } = await params;

        const messages = await db.chatMessage.findMany({
            where: { storySlug },
            include: {
                user: {
                    select: { id: true, name: true, role: true, image: true },
                },
            },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });

        return NextResponse.json(messages.reverse());
    } catch (error) {
        console.error('Fetch chat messages error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(req: Request, { params }: { params: Promise<{ storySlug: string }> }) {
    try {
        const { storySlug } = await params;

        // Dùng NextAuth session thay vì JWT riêng
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { content } = await req.json();
        if (!content || !content.trim()) {
            return NextResponse.json({ error: 'Message content cannot be empty' }, { status: 400 });
        }

        const message = await db.chatMessage.create({
            data: {
                storySlug,
                content: content.trim(),
                userId: session.user.id,
            },
            include: {
                user: {
                    select: { id: true, name: true, role: true, image: true },
                },
            },
        });

        return NextResponse.json(message, { status: 201 });
    } catch (error) {
        console.error('Post chat message error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
