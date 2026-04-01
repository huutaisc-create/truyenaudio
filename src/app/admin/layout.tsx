import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard, BookOpen, Users, Coins,
  MessageSquareWarning, Bell, Mic2, Replace,
  ClipboardList, ChevronRight, BookPlus,
} from 'lucide-react';
import { auth } from '@/auth';
import { ALL_ADMIN_ROLES, ROLE_ACCESS, type AdminRole } from '@/lib/admin-guard';
import AdminMobileNav from './AdminMobileNav';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  // Chưa đăng nhập → login
  if (!session?.user) redirect('/login');

  // Không phải admin role → trang chủ
  const role = session.user.role as AdminRole;
  if (!ALL_ADMIN_ROLES.includes(role)) redirect('/');

  const r = role;

  return (
    <div data-admin="true" className="flex min-h-screen bg-gray-100 dark:bg-zinc-900">
      <AdminMobileNav role={role} userName={session.user.name ?? ''} />
      {/* ── Sidebar ── */}
      <aside className="fixed inset-y-0 left-0 w-64 bg-white shadow-lg dark:bg-zinc-800 z-40 hidden md:flex flex-col">
        {/* Logo */}
        <div className="flex h-14 items-center justify-center border-b px-6 dark:border-zinc-700 shrink-0">
          <span className="text-lg font-bold text-orange-500">⚡ Admin Panel</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">

          {/* Dashboard — tất cả role */}
          <NavLink href="/admin" icon={<LayoutDashboard size={16} />} label="Dashboard" />

          {/* NỘI DUNG */}
          {ROLE_ACCESS.stories.includes(r) && (
            <>
              <SectionLabel label="NỘI DUNG" />
              <NavLink href="/admin/stories"       icon={<BookOpen size={16} />}   label="Quản lý Truyện" />
              <NavLink href="/admin/requests"      icon={<BookPlus size={16} />}   label="Yêu cầu truyện" />
              <NavLink href="/admin/voices"         icon={<Mic2 size={16} />}       label="Giọng đọc TTS" />
              <NavLink href="/admin/bulk-edit"      icon={<Replace size={16} />}    label="Find & Replace" />
            </>
          )}

          {/* NGƯỜI DÙNG */}
          {ROLE_ACCESS.users.includes(r) && (
            <>
              <SectionLabel label="NGƯỜI DÙNG" />
              <NavLink href="/admin/users" icon={<Users size={16} />} label="Thành viên" />
            </>
          )}

          {/* KINH TẾ */}
          {ROLE_ACCESS.economy.includes(r) && (
            <>
              <SectionLabel label="KINH TẾ" />
              <NavLink href="/admin/economy/transactions" icon={<Coins size={16} />}       label="Giao dịch Credit" />
              <NavLink href="/admin/economy/vip-plans"    icon={<ChevronRight size={16} />} label="Gói VIP" />
              <NavLink href="/admin/economy/daily-tasks"  icon={<ChevronRight size={16} />} label="Nhiệm vụ hàng ngày" />
            </>
          )}

          {/* KIỂM DUYỆT */}
          {ROLE_ACCESS.moderation.includes(r) && (
            <>
              <SectionLabel label="KIỂM DUYỆT" />
              <NavLink href="/admin/moderation/comments" icon={<MessageSquareWarning size={16} />} label="Bình luận" />
              <NavLink href="/admin/moderation/reviews"  icon={<MessageSquareWarning size={16} />} label="Đánh giá" />
              <NavLink href="/admin/moderation/keywords" icon={<ChevronRight size={16} />}         label="Từ khóa cấm" />
            </>
          )}

          {/* THÔNG BÁO */}
          {ROLE_ACCESS.notifications.includes(r) && (
            <>
              <SectionLabel label="THÔNG BÁO" />
              <NavLink href="/admin/notifications" icon={<Bell size={16} />} label="Push Notification" />
            </>
          )}

          {/* HỆ THỐNG — chỉ ADMIN */}
          {r === 'ADMIN' && (
            <>
              <SectionLabel label="HỆ THỐNG" />
              <NavLink href="/admin/logs" icon={<ClipboardList size={16} />} label="Nhật ký Admin" />
            </>
          )}
        </nav>

        {/* User info */}
        <div className="p-3 border-t dark:border-zinc-700 shrink-0">
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-zinc-700/50">
            <div className="w-7 h-7 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {session.user.name?.charAt(0)?.toUpperCase() ?? 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate dark:text-zinc-200">{session.user.name}</p>
              <p className="text-[10px] text-orange-500 font-medium uppercase tracking-wide">{role}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 md:ml-64 p-6">
        {children}
      </main>
    </div>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <p className="px-3 pt-4 pb-1 text-[10px] font-semibold tracking-widest text-gray-400 dark:text-zinc-500 uppercase">
      {label}
    </p>
  );
}

function NavLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-orange-50 hover:text-orange-600 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:hover:text-orange-400"
    >
      <span className="shrink-0 text-gray-400 dark:text-zinc-500">{icon}</span>
      <span className="font-medium">{label}</span>
    </Link>
  );
}
