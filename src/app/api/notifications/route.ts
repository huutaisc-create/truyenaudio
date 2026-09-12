// src/app/api/notifications/route.ts
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getAuthUser } from '@/lib/auth-helper';

const PAGE_SIZE = 20;

// GET /api/notifications?after=&limit=  → danh sách thông báo của user hiện tại
export async function GET(req: Request) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const after = searchParams.get('after');
    const limit = Math.min(Number(searchParams.get('limit') || PAGE_SIZE), 50);

    const items = await db.notification.findMany({
      where: { recipientId: authUser.id },
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
        commentId: n.commentId,
        roomId: n.roomId,
        messageId: n.messageId,
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
