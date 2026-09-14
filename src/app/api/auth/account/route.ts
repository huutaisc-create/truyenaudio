import { NextResponse } from 'next/server';
import db from '@/lib/db';
import jwt from 'jsonwebtoken';
import { auth } from '@/auth';

const JWT_SECRET = process.env.JWT_SECRET as string;

/** Chuỗi người dùng phải gõ đúng để xác nhận — chặn bấm nhầm. */
const CONFIRM_PHRASE = 'XOA TAI KHOAN';

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

/**
 * DELETE /api/auth/account — xoá vĩnh viễn tài khoản + toàn bộ dữ liệu liên quan.
 *
 * Google Play BẮT BUỘC app cho tạo tài khoản phải có đường xoá tài khoản
 * (cả trong app lẫn qua web). Xem prisma/schema.prisma: mọi quan hệ trỏ về User
 * đều `onDelete: Cascade`, nên xoá User là cuốn theo history, library, comment,
 * like, chat, notification, fcmToken... Không cần xoá thủ công từng bảng.
 *
 * Body: { "confirm": "XOA TAI KHOAN" }
 */
export async function DELETE(req: Request) {
    try {
        const userId = await getUserId(req);
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json().catch(() => ({} as any));
        if (body?.confirm !== CONFIRM_PHRASE) {
            return NextResponse.json(
                { error: `Cần xác nhận bằng cách gửi confirm = "${CONFIRM_PHRASE}"` },
                { status: 400 },
            );
        }

        const user = await db.user.findUnique({
            where: { id: userId },
            select: { id: true, email: true, role: true },
        });
        if (!user) {
            return NextResponse.json({ error: 'Người dùng không tồn tại' }, { status: 404 });
        }

        // Chặn admin tự xoá mình qua API — tránh mất quyền quản trị do thao tác nhầm.
        if (user.role === 'ADMIN') {
            return NextResponse.json(
                { error: 'Tài khoản quản trị không thể tự xoá. Liên hệ bộ phận kỹ thuật.' },
                { status: 403 },
            );
        }

        await db.user.delete({ where: { id: userId } });

        console.info(`[account-delete] đã xoá user ${user.id} (${user.email})`);
        return NextResponse.json({ success: true, message: 'Tài khoản đã được xoá vĩnh viễn' });
    } catch (error) {
        console.error('Delete account error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
