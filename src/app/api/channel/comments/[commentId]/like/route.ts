// src/app/api/channel/comments/[commentId]/like/route.ts
// Toggle thích một bình luận của bài đăng kênh.
//
// LƯU Ý ĐƯỜNG DẪN: cố ý đặt phẳng ở /api/channel/comments/... thay vì lồng dưới
// /api/channel/posts/[id]/comments/[commentId]/like — commentId vốn đã là duy nhất
// nên không cần postId trong URL, và đường lồng sâu như vậy tạo thư mục 9 cấp,
// vượt giới hạn của công cụ đồng bộ file đang dùng để sửa repo này.
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getAuthUser } from '@/lib/auth-helper';
import { createNotification } from '@/lib/notify';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ commentId: string }> }
) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { commentId } = await params;

    const comment = await db.channelPostComment.findUnique({
      where: { id: commentId },
      select: { id: true, userId: true, postId: true, parentId: true, status: true, content: true },
    });
    if (!comment || comment.status !== 'VISIBLE') {
      return NextResponse.json({ error: 'Bình luận không tồn tại' }, { status: 404 });
    }

    const existing = await db.channelPostCommentLike.findUnique({
      where: { userId_commentId: { userId: authUser.id, commentId } },
      select: { id: true },
    });

    const [, updated] = await db.$transaction([
      existing
        ? db.channelPostCommentLike.delete({ where: { id: existing.id } })
        : db.channelPostCommentLike.create({ data: { userId: authUser.id, commentId } }),
      db.channelPostComment.update({
        where: { id: commentId },
        data: { likeCount: { [existing ? 'decrement' : 'increment']: 1 } },
        select: { likeCount: true },
      }),
    ]);

    // Chỉ báo khi THÊM like, không báo lúc bỏ like. Gộp theo comment để 10 lượt
    // thích chỉ thành 1 dòng thông báo; cron sẽ push gộp (xem notify.ts).
    if (!existing) {
      void createNotification({
        recipientId: comment.userId,
        actorId: authUser.id,
        type: 'COMMENT_LIKE',
        groupKey: `post-like:${comment.id}`,
        postId: comment.postId,
        commentId: comment.id,
        rootCommentId: comment.parentId ?? comment.id,
        preview:
          comment.content.length > 80 ? `${comment.content.slice(0, 80)}…` : comment.content,
      });
    }

    return NextResponse.json({
      success: true,
      data: { liked: !existing, likeCount: Math.max(0, updated.likeCount) },
    });
  } catch (error) {
    console.error('POST channel comment like error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
