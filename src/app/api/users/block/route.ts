// src/app/api/users/block/route.ts
// Chặn / bỏ chặn người dùng — yêu cầu bắt buộc của chính sách UGC Google Play.
// Chặn là MỘT CHIỀU: A chặn B thì A không thấy nội dung của B nữa (client lọc
// theo danh sách GET trả về); B vẫn thấy nội dung của A bình thường.
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getAuthUser } from '@/lib/auth-helper';

// GET /api/users/block  → danh sách userId mình đã chặn (client cache để lọc feed/bình luận)
export async function GET(req: Request) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const blocks = await db.userBlock.findMany({
      where: { blockerId: authUser.id },
      select: { blockedId: true },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: blocks.map((b) => b.blockedId),
    });
  } catch (error) {
    console.error('GET /api/users/block error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/users/block  body: { userId }
export async function POST(req: Request) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const userId: string = body?.userId;

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'userId không hợp lệ' }, { status: 400 });
    }
    if (userId === authUser.id) {
      return NextResponse.json({ error: 'Không thể tự chặn chính mình' }, { status: 400 });
    }

    const target = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!target) {
      return NextResponse.json({ error: 'Người dùng không tồn tại' }, { status: 404 });
    }

    await db.userBlock.upsert({
      where: { blockerId_blockedId: { blockerId: authUser.id, blockedId: userId } },
      update: {},
      create: { blockerId: authUser.id, blockedId: userId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST /api/users/block error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/users/block  body: { userId }  → bỏ chặn
export async function DELETE(req: Request) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const userId: string = body?.userId;
    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'userId không hợp lệ' }, { status: 400 });
    }

    await db.userBlock.deleteMany({
      where: { blockerId: authUser.id, blockedId: userId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/users/block error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
