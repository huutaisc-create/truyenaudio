// src/app/api/stories/requests/route.ts
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getAuthUser } from '@/lib/auth-helper';

// GET — lấy danh sách yêu cầu (public, phân trang)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get('page') || 1));
    const limit = Math.min(Number(searchParams.get('limit') || 20), 50);
    const status = searchParams.get('status') || 'ALL'; // ALL, PENDING, DONE, REJECTED

    const where = status !== 'ALL' ? { status } : {};

    const [requests, total] = await Promise.all([
      db.storyRequest.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, image: true } },
          // Nếu đã done → include thẻ truyện
          story: {
            select: {
              id: true, slug: true, title: true,
              coverImage: true, totalChapters: true, status: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.storyRequest.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: requests,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('GET story requests error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST — gửi yêu cầu truyện mới
export async function POST(req: Request) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { title, link, note } = await req.json();
    if (!title?.trim()) {
      return NextResponse.json({ error: 'Tên truyện không được để trống' }, { status: 400 });
    }

    const request = await db.storyRequest.create({
      data: {
        title: title.trim(),
        link: link?.trim() || null,
        note: note?.trim() || null,
        userId: authUser.id,
      },
      include: {
        user: { select: { id: true, name: true, image: true } },
      },
    });

    return NextResponse.json({ success: true, data: request }, { status: 201 });
  } catch (error) {
    console.error('POST story request error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
