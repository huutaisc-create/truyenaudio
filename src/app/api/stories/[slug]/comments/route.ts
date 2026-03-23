// src/app/api/stories/[slug]/comments/route.ts
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getAuthUser } from '@/lib/auth-helper';

const PAGE_SIZE = 20;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(req.url);

    // Phân trang: cursor-based dùng `after` (commentId cuối đã có)
    const after = searchParams.get('after');     // commentId cuối client đã có
    const limit = Math.min(Number(searchParams.get('limit') || PAGE_SIZE), 50);

    // Lấy storyId từ slug
    const story = await db.story.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!story) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404 });
    }

    // Lấy user hiện tại (nếu có) để check liked
    const authUser = await getAuthUser(req);

    const comments = await db.comment.findMany({
      where: { storyId: story.id },
      include: {
        user: { select: { id: true, name: true, image: true, role: true } },
        // Check user đã like chưa
        commentLikes: authUser
          ? { where: { userId: authUser.id }, select: { id: true } }
          : false,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      // Cursor pagination: lấy comments cũ hơn `after`
      ...(after && {
        cursor: { id: after },
        skip: 1, // bỏ qua chính cái cursor
      }),
    });

    // Trả về theo thứ tự cũ → mới
    const reversed = comments.reverse();

    return NextResponse.json({
      success: true,
      data: reversed.map(c => ({
        id: c.id,
        content: c.content,
        likeCount: c.likeCount,
        createdAt: c.createdAt,
        isLiked: authUser ? c.commentLikes.length > 0 : false,
        user: c.user,
      })),
      // Client dùng firstId để load more (older comments)
      hasMore: comments.length === limit,
      nextCursor: reversed.length > 0 ? reversed[0].id : null,
    });
  } catch (error) {
    console.error('GET comments error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { content } = await req.json();
    if (!content?.trim()) {
      return NextResponse.json({ error: 'Nội dung không được để trống' }, { status: 400 });
    }

    const story = await db.story.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!story) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404 });
    }

    const comment = await db.comment.create({
      data: {
        content: content.trim(),
        userId: authUser.id,
        storyId: story.id,
      },
      include: {
        user: { select: { id: true, name: true, image: true, role: true } },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: comment.id,
        content: comment.content,
        likeCount: comment.likeCount,
        createdAt: comment.createdAt,
        isLiked: false,
        user: comment.user,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('POST comment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
