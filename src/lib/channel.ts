// src/lib/channel.ts
// Dùng chung cho kênh bài đăng "Tám Chuyện" (ChannelPost / ChannelPostComment).

import db from '@/lib/db';
import { getAuthUser, type AuthUser } from '@/lib/auth-helper';

export const POST_MAX_LEN = 5000;
export const POST_MAX_IMAGES = 10;
export const COMMENT_MAX_LEN = 1000;
export const PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;

/** Cooldown gửi bình luận, ÉP Ở BACKEND. */
export const COMMENT_COOLDOWN_MS = 15 * 1000;

/** Role được phép quản trị kênh — khớp với ROLE_ACCESS.channel của trang admin. */
export const CHANNEL_ROLES = ['ADMIN', 'EDITOR'];

/**
 * Trả về user nếu có quyền quản trị kênh, ngược lại null.
 * Dùng `getAuthUser` nên chấp nhận cả JWT (app) lẫn session NextAuth (trang admin web).
 */
export async function getAdminUser(req: Request): Promise<AuthUser | null> {
  const user = await getAuthUser(req);
  if (!user || !CHANNEL_ROLES.includes(user.role)) return null;
  return user;
}

/** Chặn từ khoá cấm. Lowercase CẢ hai phía và bỏ qua keyword rỗng — một dòng rác
 *  trong bảng SpamKeyword mà để lọt sẽ chặn TOÀN BỘ nội dung của mọi người. */
export async function containsSpamKeyword(text: string): Promise<boolean> {
  const keywords = await db.spamKeyword.findMany({ select: { keyword: true } });
  const lower = text.toLowerCase();
  return keywords.some((k) => {
    const kw = (k.keyword || '').trim().toLowerCase();
    return kw.length > 0 && lower.includes(kw);
  });
}

/** Số bản ghi mỗi trang, kẹp trong khoảng an toàn. */
export function parseLimit(raw: string | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return PAGE_SIZE;
  return Math.min(Math.floor(n), MAX_PAGE_SIZE);
}

export const USER_SELECT = {
  id: true,
  name: true,
  image: true,
  role: true,
} as const;

/**
 * Với danh sách id, trả về Set những id mà `userId` đã like.
 * Truy vấn MỘT lần theo lô — tránh N+1 khi render feed.
 */
export async function likedPostIds(userId: string, postIds: string[]): Promise<Set<string>> {
  if (postIds.length === 0) return new Set();
  const rows = await db.channelPostLike.findMany({
    where: { userId, postId: { in: postIds } },
    select: { postId: true },
  });
  return new Set(rows.map((r) => r.postId));
}

export async function likedCommentIds(userId: string, commentIds: string[]): Promise<Set<string>> {
  if (commentIds.length === 0) return new Set();
  const rows = await db.channelPostCommentLike.findMany({
    where: { userId, commentId: { in: commentIds } },
    select: { commentId: true },
  });
  return new Set(rows.map((r) => r.commentId));
}
