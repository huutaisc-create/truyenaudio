// src/app/api/channel/unread-count/route.ts
// Số bài đăng mới kể từ lần cuối user mở kênh → chấm đỏ trên tab.
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

    const count = await db.channelPost.count({
      where: {
        status: 'VISIBLE',
        // Chưa từng mở kênh → tính từ đầu. Người mới cài app sẽ thấy số bài hiện có,
        // đúng ý đồ "có nội dung chờ bạn xem".
        createdAt: { gt: read?.lastReadAt ?? new Date(0) },
      },
    });

    return NextResponse.json({ success: true, count });
  } catch (error) {
    console.error('GET channel unread-count error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
