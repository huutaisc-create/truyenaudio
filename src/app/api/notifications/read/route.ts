// src/app/api/notifications/read/route.ts
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getAuthUser } from '@/lib/auth-helper';

// POST /api/notifications/read  body: { id? }
//   - có id → đánh dấu đọc 1 thông báo
//   - không id → đánh dấu đọc TẤT CẢ
export async function POST(req: Request) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const id: string | undefined = body?.id;

    if (id) {
      await db.notification.updateMany({
        where: { id, recipientId: authUser.id },
        data: { isRead: true },
      });
    } else {
      await db.notification.updateMany({
        where: { recipientId: authUser.id, isRead: false },
        data: { isRead: true },
      });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST notifications/read error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
