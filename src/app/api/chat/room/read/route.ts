// src/app/api/chat/room/read/route.ts
// Đánh dấu "đã đọc" phòng "tam-chuyen" cho user hiện tại (badge unread ở app).
// Client nên DEBOUNCE gọi route này (mở phòng / app vào background / ngừng cuộn 3-5s),
// KHÔNG gọi mỗi tin nhắn lướt qua.
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getAuthUser } from '@/lib/auth-helper';
import { ensureTamChuyenRoom } from '@/lib/chatRoom';

export async function POST(req: Request) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const roomId = await ensureTamChuyenRoom();

    await db.chatRoomRead.upsert({
      where: { roomId_userId: { roomId, userId: authUser.id } },
      update: { lastReadAt: new Date() },
      create: { roomId, userId: authUser.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST chat room read error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
