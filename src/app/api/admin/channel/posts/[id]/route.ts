// src/app/api/admin/channel/posts/[id]/route.ts
// Sửa / ẩn / hiện lại một bài đăng kênh.
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { POST_MAX_LEN, USER_SELECT, getAdminUser } from '@/lib/channel';

// PATCH  body: { content?, status? }  — sửa nội dung hoặc ẩn/hiện bài
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getAdminUser(req);
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const data: { content?: string; status?: 'VISIBLE' | 'HIDDEN' } = {};

    if (typeof body?.content === 'string') {
      const content = body.content.trim();
      if (!content) {
        return NextResponse.json({ error: 'Nội dung không được để trống' }, { status: 400 });
      }
      if (content.length > POST_MAX_LEN) {
        return NextResponse.json(
          { error: `Nội dung tối đa ${POST_MAX_LEN} ký tự` },
          { status: 400 }
        );
      }
      data.content = content;
    }

    if (body?.status === 'VISIBLE' || body?.status === 'HIDDEN') {
      data.status = body.status;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Không có gì để cập nhật' }, { status: 400 });
    }

    const post = await db.channelPost.update({
      where: { id },
      data,
      include: { author: { select: USER_SELECT } },
    });

    return NextResponse.json({ success: true, data: post });
  } catch (error) {
    console.error('PATCH admin channel post error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE — ẩn bài (xoá MỀM). Không xoá cứng: bài bị xoá cứng sẽ kéo theo toàn bộ
// bình luận của người dùng dưới đó do khoá ngoại CASCADE.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getAdminUser(req);
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    await db.channelPost.update({ where: { id }, data: { status: 'HIDDEN' } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE admin channel post error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
