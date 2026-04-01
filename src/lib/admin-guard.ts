import { auth } from '@/auth';
import { redirect } from 'next/navigation';

export type AdminRole = 'ADMIN' | 'EDITOR' | 'FINANCE' | 'MODERATOR' | 'SUPPORT';

export const ALL_ADMIN_ROLES: AdminRole[] = ['ADMIN', 'EDITOR', 'FINANCE', 'MODERATOR', 'SUPPORT'];

/**
 * Bảo vệ route admin. Gọi đầu mỗi admin page.
 * - Không truyền allowedRoles → chỉ cần là bất kỳ admin role nào
 * - Truyền allowedRoles → chỉ các role trong danh sách được vào
 */
export async function requireAdmin(allowedRoles?: AdminRole[]) {
  const session = await auth();

  if (!session?.user) redirect('/login');

  const role = session.user.role as AdminRole;

  if (!ALL_ADMIN_ROLES.includes(role)) {
    redirect('/');
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    redirect('/admin'); // có quyền admin nhưng không đủ quyền trang này
  }

  return session;
}

/**
 * Kiểm tra role có thuộc danh sách không (dùng trong JSX để ẩn/hiện menu)
 */
export function hasRole(role: string, allowedRoles: AdminRole[]): boolean {
  return allowedRoles.includes(role as AdminRole);
}

/**
 * Ma trận quyền: trả về true nếu role được xem trang đó
 */
export const ROLE_ACCESS = {
  stories:      ['ADMIN', 'EDITOR'] as AdminRole[],
  users:        ['ADMIN', 'FINANCE', 'SUPPORT'] as AdminRole[],
  economy:      ['ADMIN', 'FINANCE'] as AdminRole[],
  moderation:   ['ADMIN', 'MODERATOR'] as AdminRole[],
  notifications:['ADMIN', 'EDITOR'] as AdminRole[],
  voices:       ['ADMIN', 'EDITOR'] as AdminRole[],
  logs:         ['ADMIN'] as AdminRole[],
};
