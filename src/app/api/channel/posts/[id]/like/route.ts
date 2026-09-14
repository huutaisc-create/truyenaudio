// src/app/api/channel/posts/[id]/like/route.ts
// Toggle thích bài đăng.
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getAuthUser } from '@/lib/auth-helper';

// POST /api/channel/posts/<id>/like
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: postId } = await params;

    const post = await db.channelPost.findUnique({
      where: { id: postId },
      select: { id: true, status: true },
    });
    if (!post || post.status !== 'VISIBLE') {
      return NextResponse.json({ error: 'Bài đăng không tồn tại' }, { status: 404 });
    }

    const existing = await db.channelPostLike.findUnique({
      where: { userId_postId: { userId: authUser.id, postId } },
      select: { id: true },
    });

    // Bộ đếm và bảng like PHẢI đổi cùng nhau, nếu không likeCount sẽ trôi dần
    // khỏi số thật mỗi lần có lỗi giữa chừng.
    const [, updated] = await db.$transaction([
      existing
        ? db.channelPostLike.delete({ where: { id: existing.id } })
        : db.channelPostLike.create({ data: { userId: authUser.id, postId } }),
      db.channelPost.update({
        where: { id: postId },
        data: { likeCount: { [existing ? 'decrement' : 'increment']: 1 } },
        select: { likeCount: true },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: { liked: !existing, likeCount: Math.max(0, updated.likeCount) },
    });
  } catch (error) {
    console.error('POST channel post like error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
