// src/app/api/stories/requests/[requestId]/route.ts
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getAuthUser } from '@/lib/auth-helper';

// PATCH — admin cập nhật trạng thái + link truyện đã làm
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const { requestId } = await params;

    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (authUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { status, storySlug } = await req.json();

    // Nếu mark DONE + có storySlug → link tới truyện trong app
    let storyId: string | null = null;
    if (status === 'DONE' && storySlug) {
      const story = await db.story.findUnique({
        where: { slug: storySlug },
        select: { id: true },
      });
      storyId = story?.id ?? null;
    }

    const updated = await db.storyRequest.update({
      where: { id: requestId },
      data: {
        status,
        ...(storyId && { storyId }),
      },
      include: {
        user: { select: { id: true, name: true, image: true } },
        story: {
          select: {
            id: true, slug: true, title: true,
            coverImage: true, totalChapters: true, status: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('PATCH story request error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE — admin xóa request
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const { requestId } = await params;

    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (authUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await db.storyRequest.delete({ where: { id: requestId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE story request error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
