// ⚠️ ROUTE CŨ — APP KHÔNG CÒN GỌI (giữ lại có chủ đích, chưa xoá).
//
// Thuộc mô hình PHÒNG CHAT NHẮN TIN NGANG HÀNG, đã bị thay bằng KÊNH BÀI ĐĂNG.
// Route đang phục vụ app nằm ở `src/app/api/channel/*`.
//
// Bảng `RoomMessage` vẫn còn trong DB nhưng không được ghi thêm.
// Chi tiết: Social_Final.md — PHẦN 8.
// src/app/api/chat/room/messages/route.ts
// Phòng chat công khai "Tám chuyện" — KHÁC ChatMessage theo storySlug (route cũ: /api/chat/[storySlug]/messages).
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getAuthUser } from '@/lib/auth-helper';
import { createNotification } from '@/lib/notify';
import { ensureTamChuyenRoom } from '@/lib/chatRoom';

const PAGE_SIZE = 30;
const MAX_CONTENT_LEN = 1000;
const MAX_MENTIONS = 10;

// GET /api/chat/room/messages?after=&limit=  → public, cursor pagination (giống comments)
export async function GET(req: Request) {
  try {
    const roomId = await ensureTamChuyenRoom();
    const { searchParams } = new URL(req.url);
    const after = searchParams.get('after');
    const limit = Math.min(Number(searchParams.get('limit') || PAGE_SIZE), 50);

    const messages = await db.roomMessage.findMany({
      where: { roomId, status: 'VISIBLE' },
      include: {
        user: { select: { id: true, name: true, image: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      ...(after && { cursor: { id: after }, skip: 1 }),
    });

    const reversed = messages.reverse();
    return NextResponse.json({
      success: true,
      data: reversed,
      hasMore: messages.length === limit,
      nextCursor: reversed.length > 0 ? reversed[0].id : null,
    });
  } catch (error) {
    console.error('GET chat room messages error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/chat/room/messages  body: { content, mentions?: string[] }  → JWT bắt buộc
export async function POST(req: Request) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const content: string = (body?.content ?? '').trim();
    const rawMentions: string[] = Array.isArray(body?.mentions) ? body.mentions : [];

    if (!content) {
      return NextResponse.json({ error: 'Nội dung không được để trống' }, { status: 400 });
    }
    if (content.length > MAX_CONTENT_LEN) {
      return NextResponse.json({ error: `Tin nhắn tối đa ${MAX_CONTENT_LEN} ký tự` }, { status: 400 });
    }

    const spamKeywords = await db.spamKeyword.findMany({ select: { keyword: true } });
    const lower = content.toLowerCase();
    // Phải lowercase CẢ keyword (keyword lưu hoa sẽ không bao giờ khớp) và bỏ
    // qua keyword rỗng/toàn khoảng trắng — ''.includes() luôn true, 1 dòng rác
    // trong bảng SpamKeyword sẽ chặn TOÀN BỘ tin nhắn.
    const hit = spamKeywords.find(k => {
      const kw = (k.keyword || '').trim().toLowerCase();
      return kw.length > 0 && lower.includes(kw);
    });
    if (hit) {
      return NextResponse.json({ error: 'Tin nhắn chứa nội dung không phù hợp.' }, { status: 400 });
    }

    const roomId = await ensureTamChuyenRoom();

    const message = await db.roomMessage.create({
      data: { roomId, userId: authUser.id, content },
      include: {
        user: { select: { id: true, name: true, image: true, role: true } },
      },
    });

    // ── @mention: nhận danh sách userId từ client (đã resolve tên -> id ở UI) ──
    const mentionIds = [...new Set(rawMentions)]
      .filter((id) => typeof id === 'string' && id && id !== authUser.id)
      .slice(0, MAX_MENTIONS);

    if (mentionIds.length > 0) {
      const validUsers = await db.user.findMany({
        where: { id: { in: mentionIds } },
        select: { id: true },
      });
      const preview = content.length > 80 ? `${content.slice(0, 80)}…` : content;

      await Promise.all(
        validUsers.map((u) =>
          createNotification({
            recipientId: u.id,
            actorId: authUser.id,
            type: 'CHAT_MENTION',
            groupKey: `mention:${roomId}:${message.id}:${u.id}`, // 1 thông báo / người được nhắc / tin nhắn
            roomId,
            messageId: message.id,
            preview,
          })
        )
      );
    }

    return NextResponse.json({ success: true, data: message }, { status: 201 });
  } catch (error) {
    console.error('POST chat room message error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
