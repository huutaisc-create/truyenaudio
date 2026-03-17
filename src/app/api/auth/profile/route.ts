import { NextResponse } from 'next/server';
import db from '@/lib/db';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { auth } from '@/auth';

const JWT_SECRET = process.env.JWT_SECRET || 'webtruyen-secret-key-123456';

async function getUserId(req: Request): Promise<string | null> {
    // Ưu tiên NextAuth session (web)
    const session = await auth();
    if (session?.user?.id) return session.user.id;

    // Fallback JWT Bearer token (mobile)
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
        try {
            const decoded: any = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
            return decoded.id;
        } catch { return null; }
    }
    return null;
}

export async function PATCH(req: Request) {
    try {
        const userId = await getUserId(req);
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { name, image, currentPassword, newPassword } = body;

        if (name !== undefined && (!name || name.trim().length < 2)) {
            return NextResponse.json({ error: 'Tên phải ít nhất 2 ký tự' }, { status: 400 });
        }

        const updateData: any = {};
        if (name) updateData.name = name.trim();
        if (image !== undefined) updateData.image = image;

        if (newPassword) {
            if (!currentPassword) {
                return NextResponse.json({ error: 'Vui lòng nhập mật khẩu hiện tại' }, { status: 400 });
            }
            if (newPassword.length < 6) {
                return NextResponse.json({ error: 'Mật khẩu mới phải ít nhất 6 ký tự' }, { status: 400 });
            }
            const user = await db.user.findUnique({ where: { id: userId } });
            if (!user?.password) {
                return NextResponse.json({ error: 'Tài khoản này không có mật khẩu (đăng nhập Google)' }, { status: 400 });
            }
            const isMatch = await bcrypt.compare(currentPassword, user.password);
            if (!isMatch) {
                return NextResponse.json({ error: 'Mật khẩu hiện tại không đúng' }, { status: 400 });
            }
            updateData.password = await bcrypt.hash(newPassword, 10);
        }

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ error: 'Không có dữ liệu để cập nhật' }, { status: 400 });
        }

        const updatedUser = await db.user.update({
            where: { id: userId },
            data: updateData,
            select: { id: true, email: true, name: true, image: true, role: true },
        });

        return NextResponse.json({ message: 'Cập nhật thành công', user: updatedUser });
    } catch (error) {
        console.error('Update profile error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
