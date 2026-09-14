// src/app/api/channel/comments/[commentId]/route.ts
// Xoá MỀM bình luận bài đăng — chủ bình luận hoặc ADMIN.
//
// Xoá mềm chứ không xoá cứng: comment gốc bị xoá cứng sẽ kéo theo toàn bộ reply
// con (khoá ngoại CASCADE), làm mất luôn phần trả lời của người khác.
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getAuthUser } from '@/lib/auth-helper';

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ commentId: string }> }
) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { commentId } = await params;

    const comment = await db.channelPostComment.findUnique({
      where: { id: commentId },
      select: { id: true, userId: true, postId: true, parentId: true, status: true },
    });
    if (!comment) {
      return NextResponse.json({ error: 'Bình luận không tồn tại' }, { status: 404 });
    }
    if (comment.userId !== authUser.id && authUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Bạn không có quyền xoá bình luận này' }, { status: 403 });
    }
    if (comment.status !== 'VISIBLE') {
      return NextResponse.json({ success: true }); // đã xoá rồi, coi như xong
    }

    await db.$transaction([
      db.channelPostComment.update({
        where: { id: commentId },
        data: { status: 'DELETED' },
      }),
      db.channelPost.update({
        where: { id: comment.postId },
        data: { commentCount: { decrement: 1 } },
      }),
      ...(comment.parentId
        ? [
            db.channelPostComment.update({
              where: { id: comment.parentId },
              data: { replyCount: { decrement: 1 } },
            }),
          ]
        : []),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE channel comment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
