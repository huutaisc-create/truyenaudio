// src/app/api/channel/posts/[id]/like/route.ts
// Toggle thích bài đăng.
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getAuthUser } from '@/lib/auth-helper';
import { createNotification } from '@/lib/notify';

// POST /api/channel/posts/<id>/like
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: postId } = await params;

    const post = await db.channelPost.findUnique({
      where: { id: postId },
      select: { id: true, status: true, authorId: true, content: true },
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

    // Báo cho CHỦ BÀI ĐĂNG, chỉ khi THÊM like (bỏ like thì không báo).
    // Gộp theo BÀI để 50 lượt thích chỉ thành một dòng "A và 49 người khác".
    // groupKey khác hẳn 'post-like:<commentId>' của thích-bình-luận, đừng trùng.
    // KHÔNG gửi commentId: đó chính là dấu hiệu để phân biệt "thích bài đăng" với
    // "thích bình luận" lúc dựng câu chữ (xem notify.ts và app_notification.dart).
    if (!existing) {
      void createNotification({
        recipientId: post.authorId,
        actorId: authUser.id,
        type: 'COMMENT_LIKE',
        groupKey: `post-liked:${postId}`,
        postId,
        preview: post.content.length > 80 ? `${post.content.slice(0, 80)}…` : post.content,
      });
    }

    return NextResponse.json({
      success: true,
      data: { liked: !existing, likeCount: Math.max(0, updated.likeCount) },
    });
  } catch (error) {
    console.error('POST channel post like error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
