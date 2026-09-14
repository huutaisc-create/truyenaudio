// src/app/api/notifications/route.ts
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getAuthUser } from '@/lib/auth-helper';

const PAGE_SIZE = 20;

// Nhóm chức năng cho bộ lọc trong app (chuông): mỗi nhóm là một tập loại thông báo.
// CHAT_MENTION xếp chung "bình luận" — thông báo cũ của phòng chat, vẫn phải xem được.
const CATEGORY_TYPES: Record<string, string[]> = {
  comment: ['COMMENT_REPLY', 'CHAT_MENTION'],
  like: ['COMMENT_LIKE'],
  new_story: ['NEW_STORY'],
  story_update: ['STORY_UPDATE'],
};

// GET /api/notifications?after=&limit=&category=  → danh sách thông báo của user hiện tại
export async function GET(req: Request) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const after = searchParams.get('after');
    const limit = Math.min(Number(searchParams.get('limit') || PAGE_SIZE), 50);
    const category = searchParams.get('category');
    const types = category ? CATEGORY_TYPES[category] : undefined;

    const items = await db.notification.findMany({
      where: {
        recipientId: authUser.id,
        // category lạ (app cũ gửi tên nhóm không còn dùng) → bỏ qua bộ lọc,
        // trả về tất cả, hơn là trả rỗng làm người dùng tưởng mất thông báo.
        ...(types ? { type: { in: types as never[] } } : {}),
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: limit,
      ...(after && { cursor: { id: after }, skip: 1 }),
    });

    // Lấy thông tin actor (người gây ra) theo batch
    const actorIds = [...new Set(items.map(i => i.actorId).filter(Boolean))] as string[];
    const actors = actorIds.length
      ? await db.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, name: true, image: true },
        })
      : [];
    const actorMap = Object.fromEntries(actors.map(a => [a.id, a]));

    // Thông báo truyện mới / truyện cập nhật KHÔNG có actor — thứ cần hiện là TÊN
    // TRUYỆN. Lấy theo lô cho mọi thông báo có storyId (rẻ, và cũng có ích cho
    // reply/like để sau này muốn hiện tên truyện thì đã có sẵn).
    const storyIds = [...new Set(items.map(i => i.storyId).filter(Boolean))] as string[];
    const stories = storyIds.length
      ? await db.story.findMany({
          where: { id: { in: storyIds } },
          select: { id: true, title: true, coverImage: true },
        })
      : [];
    const storyMap = Object.fromEntries(stories.map(s => [s.id, s]));

    return NextResponse.json({
      success: true,
      data: items.map(n => ({
        id: n.id,
        type: n.type,
        isRead: n.isRead,
        actorCount: n.actorCount,
        actor: n.actorId ? actorMap[n.actorId] ?? null : null,
        storyId: n.storyId,
        storySlug: n.storySlug,
        storyTitle: n.storyId ? storyMap[n.storyId]?.title ?? null : null,
        storyCover: n.storyId ? storyMap[n.storyId]?.coverImage ?? null : null,
        commentId: n.commentId,
        rootCommentId: n.rootCommentId,
        roomId: n.roomId,
        messageId: n.messageId,
        // CÓ postId → app mở bài đăng kênh; không có → mở truyện.
        // (Cố ý không thêm giá trị enum mới, xem prisma/social-migration-4.sql.)
        postId: n.postId,
        preview: n.preview,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
      })),
      hasMore: items.length === limit,
      nextCursor: items.length ? items[items.length - 1].id : null,
    });
  } catch (error) {
    console.error('GET notifications error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
