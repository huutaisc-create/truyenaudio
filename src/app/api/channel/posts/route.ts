// src/app/api/channel/posts/route.ts
// Feed kênh "Tám Chuyện" — công khai, ai cũng đọc được. Đăng bài là việc của admin,
// nằm ở /api/admin/channel/posts.
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getAuthUser } from '@/lib/auth-helper';
import { USER_SELECT, likedPostIds, parseLimit } from '@/lib/channel';

// GET /api/channel/posts?after=<id>&limit=20  → bài MỚI NHẤT trước (feed)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const after = searchParams.get('after');
    const limit = parseLimit(searchParams.get('limit'));

    const posts = await db.channelPost.findMany({
      where: { status: 'VISIBLE' },
      include: { author: { select: USER_SELECT } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      ...(after && { cursor: { id: after }, skip: 1 }),
    });

    // likedByMe: hỏi MỘT lần cho cả trang thay vì mỗi bài một truy vấn.
    const me = await getAuthUser(req);
    const liked = me ? await likedPostIds(me.id, posts.map((p) => p.id)) : new Set<string>();

    return NextResponse.json({
      success: true,
      data: posts.map((p) => ({ ...p, likedByMe: liked.has(p.id) })),
      hasMore: posts.length === limit,
      nextCursor: posts.length > 0 ? posts[posts.length - 1].id : null,
    });
  } catch (error) {
    console.error('GET channel posts error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
