// src/app/api/admin/channel/posts/route.ts
// Admin đăng bài lên kênh "Tám Chuyện" (text + ảnh), kèm tuỳ chọn bắn push cho tất cả.
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { sendPushToAllDevices } from '@/lib/fcm';
import {
  POST_MAX_IMAGES,
  POST_MAX_LEN,
  USER_SELECT,
  getAdminUser,
  parseLimit,
} from '@/lib/channel';

// GET /api/admin/channel/posts?after=&limit=  → danh sách cho trang quản trị,
// KHÁC feed công khai ở chỗ hiện cả bài đã ẩn để admin còn thấy mà khôi phục.
export async function GET(req: Request) {
  try {
    const admin = await getAdminUser(req);
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const after = searchParams.get('after');
    const limit = parseLimit(searchParams.get('limit'));

    const posts = await db.channelPost.findMany({
      include: { author: { select: USER_SELECT } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      ...(after && { cursor: { id: after }, skip: 1 }),
    });

    return NextResponse.json({
      success: true,
      data: posts,
      hasMore: posts.length === limit,
      nextCursor: posts.length > 0 ? posts[posts.length - 1].id : null,
    });
  } catch (error) {
    console.error('GET admin channel posts error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/admin/channel/posts   body: { content, images?: string[], sendPush?: boolean }
export async function POST(req: Request) {
  try {
    const admin = await getAdminUser(req);
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const content: string = typeof body?.content === 'string' ? body.content.trim() : '';
    const rawImages: unknown = body?.images;
    const sendPush: boolean = body?.sendPush === true;

    if (!content) {
      return NextResponse.json({ error: 'Nội dung không được để trống' }, { status: 400 });
    }
    if (content.length > POST_MAX_LEN) {
      return NextResponse.json(
        { error: `Nội dung tối đa ${POST_MAX_LEN} ký tự` },
        { status: 400 }
      );
    }

    // Chỉ nhận URL do chính hệ thống trả về từ /api/upload. Không cho dán URL ngoài:
    // ảnh ngoài có thể chết bất cứ lúc nào, và là một đường để nhúng nội dung lạ.
    const images: string[] = Array.isArray(rawImages)
      ? rawImages
          .filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
          .map((u) => u.trim())
          .filter((u) => u.startsWith('/'))
          .slice(0, POST_MAX_IMAGES)
      : [];

    const post = await db.channelPost.create({
      data: { content, images, authorId: admin.id },
      include: { author: { select: USER_SELECT } },
    });

    // Push broadcast — KHÔNG tạo bản ghi Notification cho từng người (vài nghìn user
    // = vài nghìn dòng cho một sự kiện). Chấm đỏ trên tab lo phần "có bài chưa đọc".
    let pushed = 0;
    if (sendPush) {
      const preview = content.length > 120 ? `${content.slice(0, 120)}…` : content;
      pushed = await sendPushToAllDevices({
        title: 'Tám Chuyện có bài mới',
        body: preview,
        highPriority: true,
        data: { type: 'NEW_POST', postId: post.id },
      });
    }

    return NextResponse.json({ success: true, data: post, pushed }, { status: 201 });
  } catch (error) {
    console.error('POST admin channel post error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
