// src/app/api/stories/[slug]/comments/[commentId]/route.ts
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getAuthUser } from '@/lib/auth-helper';

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ slug: string; commentId: string }> }
) {
  try {
    const { commentId } = await params;

    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const comment = await db.comment.findUnique({
      where: { id: commentId },
      select: { id: true, userId: true, parentId: true, status: true },
    });
    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    // Chỉ cho phép: chính chủ hoặc ADMIN
    if (comment.userId !== authUser.id && authUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (comment.status === 'DELETED') {
      return NextResponse.json({ success: true }); // đã xoá rồi, idempotent
    }

    // SOFT-DELETE: đổi trạng thái, GIỮ reply con (không mồ côi)
    await db.comment.update({
      where: { id: commentId },
      data: { status: 'DELETED' },
    });

    // Nếu là REPLY → giảm replyCount của comment gốc
    if (comment.parentId) {
      await db.comment.update({
        where: { id: comment.parentId },
        data: { replyCount: { decrement: 1 } },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE comment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
