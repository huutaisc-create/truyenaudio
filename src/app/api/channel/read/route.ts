// src/app/api/channel/read/route.ts
// Đánh dấu "đã xem kênh" cho user hiện tại → dùng để tính chấm đỏ bài chưa đọc.
//
// DÙNG LẠI bảng ChatRoomRead và dòng phòng 'tam-chuyen' sẵn có thay vì tạo bảng mới:
// nó vốn chỉ lưu đúng một mốc thời gian (roomId, userId, lastReadAt), mà kênh bài
// đăng cũng chỉ cần đúng thứ đó. Kênh thay thế phòng chat nên không có xung đột ý nghĩa.
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
    console.error('POST channel read error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
