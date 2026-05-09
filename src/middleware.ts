import NextAuth from 'next-auth';
import { authConfig } from './auth.config';

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  // ── Auth check (NextAuth xử lý bên trong auth wrapper) ──────────────
  return;
});

export const config = {
  matcher: [
    // Chạy trên mọi route trừ _next/static, _next/image, và file tĩnh
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
