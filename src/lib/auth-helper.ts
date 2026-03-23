// src/lib/auth-helper.ts
// Helper dùng chung: verify JWT (Flutter) hoặc NextAuth session (Web)

import jwt from 'jsonwebtoken';
import { auth } from '@/auth';

const JWT_SECRET = process.env.JWT_SECRET || 'webtruyen-secret-key-123456';

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

export async function getAuthUser(req: Request): Promise<AuthUser | null> {
  // 1. Thử JWT từ Authorization header (Flutter app)
  const authHeader = req.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
      return decoded;
    } catch {
      // Token invalid → thử NextAuth
    }
  }

  // 2. Thử NextAuth session (Web)
  const session = await auth();
  if (session?.user?.id) {
    return {
      id: session.user.id,
      email: session.user.email ?? '',
      name: session.user.name ?? null,
      role: (session.user as { role?: string }).role ?? 'USER',
    };
  }

  return null;
}
