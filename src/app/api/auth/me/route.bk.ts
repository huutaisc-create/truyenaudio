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
            return NextResponse.json({ error: 'Token không hợp lệ hoặc đã hết hạn' }, { status: 401 });
        }

        const user = await db.user.findUnique({
            where: { id: decoded.id },
            select: {
                id: true,
                email: true,
                name: true,
                image: true,
                role: true,
                createdAt: true,
                googleId: true,
                // Thống kê nhanh
                _count: {
                    select: {
                        library: true,
                        readingHistory: true,
                    },
                },
            },
        });

        if (!user) {
            return NextResponse.json({ error: 'Người dùng không tồn tại' }, { status: 404 });
        }

        return NextResponse.json({
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
            role: user.role,
            createdAt: user.createdAt,
            hasPassword: false, // không expose
            hasGoogle: !!user.googleId,
            stats: {
                libraryCount: user._count.library,
                historyCount: user._count.readingHistory,
            },
        });
    } catch (error) {
        console.error('Get profile error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
