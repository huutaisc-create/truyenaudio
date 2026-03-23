// src/app/api/stories/[slug]/comments/[commentId]/like/route.ts
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getAuthUser } from '@/lib/auth-helper';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string; commentId: string }> }
) {
  try {
    const { commentId } = await params;

    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check comment tồn tại
    const comment = await db.comment.findUnique({
      where: { id: commentId },
      select: { id: true, likeCount: true },
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

    return NextResponse.json({
      success: true,
      data: { isLiked, likeCount: newLikeCount },
    });
  } catch (error) {
    console.error('Like comment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
