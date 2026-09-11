// src/app/api/notifications/unread-count/route.ts
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getAuthUser } from '@/lib/auth-helper';

// GET /api/notifications/unread-count → số thông báo chưa đọc (badge chuông)
export async function GET(req: Request) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const count = await db.notification.count({
      where: { recipientId: authUser.id, isRead: false },
    });
    return NextResponse.json({ count });
  } catch (error) {
    console.error('GET unread-count error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
