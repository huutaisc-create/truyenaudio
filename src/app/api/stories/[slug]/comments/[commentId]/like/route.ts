// src/app/api/stories/[slug]/comments/[commentId]/like/route.ts
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getAuthUser } from '@/lib/auth-helper';
import { createNotification } from '@/lib/notify';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string; commentId: string }> }
) {
  try {
    const { slug, commentId } = await params;

    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check comment tồn tại (thêm userId + storyId + content để tạo thông báo)
    const comment = await db.comment.findUnique({
      where: { id: commentId },
      select: { id: true, likeCount: true, userId: true, storyId: true, content: true, parentId: true },
    });
    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    // Toggle like
    const existingLike = await db.commentLike.findUnique({
      where: { userId_commentId: { userId: authUser.id, commentId } },
    });

    let isLiked: boolean;
    let newLikeCount: number;

    if (existingLike) {
      // Bỏ like
      await db.commentLike.delete({
        where: { userId_commentId: { userId: authUser.id, commentId } },
      });
      newLikeCount = Math.max(0, comment.likeCount - 1);
      isLiked = false;
    } else {
      // Like
      await db.commentLike.create({
        data: { userId: authUser.id, commentId },
      });
      newLikeCount = comment.likeCount + 1;
      isLiked = true;
    }

    // Update likeCount trên Comment
    await db.comment.update({
      where: { id: commentId },
      data: { likeCount: newLikeCount },
    });

    // Chỉ tạo thông báo khi LIKE (không phải bỏ like). Helper tự bỏ qua nếu tự-like.
    if (isLiked) {
      const preview = comment.content.length > 80
        ? `${comment.content.slice(0, 80)}…`
        : comment.content;
      await createNotification({
        recipientId: comment.userId,
        actorId: authUser.id,
        type: 'COMMENT_LIKE',
        groupKey: `like:${commentId}`, // gộp mọi lượt like của cùng comment
        storyId: comment.storyId,
        storySlug: slug,
        commentId: comment.id,
        rootCommentId: comment.parentId ?? comment.id, // root của comment được like
        preview,
      });
    }

    return NextResponse.json({
      success: true,
      data: { isLiked, likeCount: newLikeCount },
    });
  } catch (error) {
    console.error('Like comment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
