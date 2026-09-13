// src/app/api/chat/room/unread-count/route.ts
// Badge tin nhắn chưa đọc của phòng "tam-chuyen" (KHÁC unread-count của /api/notifications).
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getAuthUser } from '@/lib/auth-helper';
import { ensureTamChuyenRoom } from '@/lib/chatRoom';

export async function GET(req: Request) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const roomId = await ensureTamChuyenRoom();

    const read = await db.chatRoomRead.findUnique({
      where: { roomId_userId: { roomId, userId: authUser.id } },
      select: { lastReadAt: true },
    });

    const count = await db.roomMessage.count({
      where: {
        roomId,
        status: 'VISIBLE',
        userId: { not: authUser.id }, // không tính tin nhắn của chính mình
        createdAt: { gt: read?.lastReadAt ?? new Date(0) },
      },
    });

    return NextResponse.json({ success: true, count });
  } catch (error) {
    console.error('GET chat room unread-count error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
