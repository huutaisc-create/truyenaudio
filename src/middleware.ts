import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const { auth } = NextAuth(authConfig);

// ── Maintenance mode ────────────────────────────────────────────────────────
const MAINTENANCE = process.env.MAINTENANCE_MODE === 'true';

// Các path được miễn trừ khi maintenance (admin + trang maintenance chính nó)
const EXEMPT = ['/maintenance', '/admin'];

export default auth((req: NextRequest & { auth?: unknown }) => {
  if (MAINTENANCE) {
    const { pathname } = req.nextUrl;
    const isExempt = EXEMPT.some(p => pathname === p || pathname.startsWith(p + '/'));
    if (!isExempt) {
      const url = req.nextUrl.clone();
      url.pathname = '/maintenance';
      return NextResponse.redirect(url);
    }
  }

  // ── Auth check (NextAuth xử lý bên trong auth wrapper) ──────────────
  return;
});

export const config = {
  matcher: [
    // Chạy trên mọi route trừ _next/static, _next/image, và file tĩnh
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
