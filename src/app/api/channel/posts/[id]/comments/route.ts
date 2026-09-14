// src/app/api/channel/posts/[id]/comments/route.ts
// Bình luận trên bài đăng kênh — nest 1 cấp, parentId LUÔN trỏ về comment gốc.
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getAuthUser } from '@/lib/auth-helper';
import { createNotification } from '@/lib/notify';
import {
  COMMENT_COOLDOWN_MS,
  COMMENT_MAX_LEN,
  USER_SELECT,
  containsSpamKeyword,
  likedCommentIds,
  parseLimit,
} from '@/lib/channel';
import { isRateLimited, recordFailure } from '@/lib/rateLimit';

/**
 * GET /api/channel/posts/<id>/comments?parentId=&after=&limit=
 *  - Không có parentId → danh sách comment GỐC, mới nhất trước.
 *  - Có parentId       → các reply của comment đó, cũ → mới (đọc thread xuôi thời gian).
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: postId } = await params;
    const { searchParams } = new URL(req.url);
    const parentId = searchParams.get('parentId');
    const after = searchParams.get('after');
    const limit = parseLimit(searchParams.get('limit'));

    const comments = await db.channelPostComment.findMany({
      where: {
        postId,
        parentId: parentId ?? null,
        status: 'VISIBLE',
      },
      include: { user: { select: USER_SELECT } },
      orderBy: { createdAt: parentId ? 'asc' : 'desc' },
      take: limit,
      ...(after && { cursor: { id: after }, skip: 1 }),
    });

    const me = await getAuthUser(req);
    const liked = me
      ? await likedCommentIds(me.id, comments.map((c) => c.id))
      : new Set<string>();

    return NextResponse.json({
      success: true,
      data: comments.map((c) => ({ ...c, likedByMe: liked.has(c.id) })),
      hasMore: comments.length === limit,
      nextCursor: comments.length > 0 ? comments[comments.length - 1].id : null,
    });
  } catch (error) {
    console.error('GET channel post comments error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/channel/posts/<id>/comments   body: { content, parentId? }
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: postId } = await params;

    // Cooldown ÉP Ở BACKEND. Bình luận truyện hiện chỉ chặn ở client nên script gọi
    // thẳng API vẫn spam được — chỗ mới này không lặp lại sai lầm đó.
    const cdKey = `channel:comment:${authUser.id}`;
    if (!isRateLimited(cdKey, 1).ok) {
      return NextResponse.json(
        { error: 'Bạn gửi nhanh quá, chờ chút rồi thử lại nhé.' },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const content: string = typeof body?.content === 'string' ? body.content.trim() : '';
    const parentId: string | null =
      typeof body?.parentId === 'string' && body.parentId ? body.parentId : null;

    if (!content) {
      return NextResponse.json({ error: 'Nội dung không được để trống' }, { status: 400 });
    }
    if (content.length > COMMENT_MAX_LEN) {
      return NextResponse.json(
        { error: `Bình luận tối đa ${COMMENT_MAX_LEN} ký tự` },
        { status: 400 }
      );
    }
    if (await containsSpamKeyword(content)) {
      return NextResponse.json(
        { error: 'Bình luận chứa nội dung không phù hợp.' },
        { status: 400 }
      );
    }

    const post = await db.channelPost.findUnique({
      where: { id: postId },
      select: { id: true, status: true, authorId: true },
    });
    if (!post || post.status !== 'VISIBLE') {
      return NextResponse.json({ error: 'Bài đăng không tồn tại' }, { status: 404 });
    }

    // Nest 1 CẤP: nếu reply vào một reply thì quy về gốc của nó, để cây không sâu dần.
    let rootId: string | null = null;
    let parentAuthorId: string | null = null;
    if (parentId) {
      const parent = await db.channelPostComment.findUnique({
        where: { id: parentId },
        select: { id: true, postId: true, parentId: true, userId: true, status: true },
      });
      if (!parent || parent.postId !== postId || parent.status !== 'VISIBLE') {
        return NextResponse.json({ error: 'Bình luận gốc không tồn tại' }, { status: 404 });
      }
      rootId = parent.parentId ?? parent.id;
      parentAuthorId = parent.userId;
    }

    const comment = await db.channelPostComment.create({
      data: { postId, userId: authUser.id, content, parentId: rootId },
      include: { user: { select: USER_SELECT } },
    });

    // Bộ đếm denormalize — cập nhật cùng lúc để feed khỏi COUNT(*) mỗi lần load.
    await db.$transaction([
      db.channelPost.update({
        where: { id: postId },
        data: { commentCount: { increment: 1 } },
      }),
      ...(rootId
        ? [
            db.channelPostComment.update({
              where: { id: rootId },
              data: { replyCount: { increment: 1 } },
            }),
          ]
        : []),
    ]);

    recordFailure(cdKey, COMMENT_COOLDOWN_MS); // ghi nhận lượt gửi cho cooldown

    const preview = content.length > 80 ? `${content.slice(0, 80)}…` : content;

    if (parentAuthorId) {
      // TRẢ LỜI một bình luận → báo cho chủ bình luận đó.
      // (createNotification tự bỏ qua khi người nhận chính là người gửi.)
      void createNotification({
        recipientId: parentAuthorId,
        actorId: authUser.id,
        type: 'COMMENT_REPLY',
        groupKey: `post-reply:${comment.id}`,
        postId,
        commentId: comment.id,
        rootCommentId: rootId,
        preview,
      });
    } else {
      // BÌNH LUẬN GỐC trên bài đăng → báo cho CHỦ BÀI ĐĂNG (admin).
      //
      // Trước đây thiếu nhánh này: chỉ khi ai đó trả lời một bình luận mới có thông
      // báo, còn người ta vào bình luận thẳng dưới bài thì chủ bài không hề biết —
      // đúng trường hợp hay gặp nhất. Gộp theo BÀI (không theo từng bình luận) để
      // 30 người bình luận vào cùng một bài chỉ thành một dòng "A và 29 người khác".
      void createNotification({
        recipientId: post.authorId,
        actorId: authUser.id,
        type: 'COMMENT_REPLY',
        groupKey: `post-comment:${postId}`,
        postId,
        commentId: comment.id,
        preview,
      });
    }

    return NextResponse.json(
      { success: true, data: { ...comment, likedByMe: false } },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST channel post comment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
