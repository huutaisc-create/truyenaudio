import { NextResponse } from 'next/server';
import db from '@/lib/db';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'webtruyen-secret-key-123456';

function getUserId(req: Request): string | null {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  try {
    const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET) as { id: string };
    return decoded.id;
  } catch {
    return null;
  }
}

// GET — lấy genre prefs hiện tại
export async function GET(req: Request) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { favoriteGenres: true },
  });

  return NextResponse.json({ genres: user?.favoriteGenres ?? [] });
}

// PATCH — cập nhật genre prefs
export async function PATCH(req: Request) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const genres: string[] = Array.isArray(body.genres) ? body.genres : [];

    await db.user.update({
      where: { id: userId },
      data: { favoriteGenres: genres },
    });

    return NextResponse.json({ ok: true, genres });
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
