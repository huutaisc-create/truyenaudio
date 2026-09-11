// src/app/api/fcm/token/route.ts
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getAuthUser } from '@/lib/auth-helper';

// POST /api/fcm/token  body: { token, platform }  → lưu/cập nhật FCM token của user
// Gọi khi: đăng nhập xong, hoặc khi FCM refresh token.
export async function POST(req: Request) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { token, platform } = await req.json();
    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'token is required' }, { status: 400 });
    }

    // token là unique. Nếu token đã tồn tại (đổi tài khoản trên cùng máy) → gán lại userId.
    await db.userFcmToken.upsert({
      where: { token },
      update: { userId: authUser.id, platform: platform ?? 'android' },
      create: { userId: authUser.id, token, platform: platform ?? 'android' },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST fcm/token error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/fcm/token  body: { token }  → xoá token (logout / token hết hiệu lực)
export async function DELETE(req: Request) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { token } = await req.json().catch(() => ({}));
    if (token) {
      await db.userFcmToken.deleteMany({ where: { token, userId: authUser.id } });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE fcm/token error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
