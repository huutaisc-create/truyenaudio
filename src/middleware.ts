import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import { NextResponse } from 'next/server';

const MOBILE_UA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

// Các path KHÔNG redirect mobile (API, static, trang download chính, auth)
const MOBILE_SKIP = ['/tai-app', '/api/', '/_next/', '/favicon', '/logo', '/covers'];

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const ua = req.headers.get('user-agent') ?? '';

  // ── Mobile redirect ──────────────────────────────────────────────────
  const isMobile = MOBILE_UA.test(ua);
  const skipMobile =
    MOBILE_SKIP.some(p => pathname.startsWith(p)) ||
    pathname.includes('.'); // bỏ qua file tĩnh (.svg, .png, ...)

  if (isMobile && !skipMobile) {
    return NextResponse.redirect(new URL('/tai-app', req.url));
  }

  // ── Auth check (NextAuth xử lý bên trong auth wrapper) ──────────────
  return NextResponse.next();
});

export const config = {
  matcher: [
    // Chạy trên mọi route trừ _next/static, _next/image, và file tĩnh
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
