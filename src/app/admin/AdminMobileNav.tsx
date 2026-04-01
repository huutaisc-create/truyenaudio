'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, BookOpen, Users, Coins,
  MessageSquareWarning, Bell, Mic2, Replace,
  ClipboardList, ChevronRight, BookPlus, Menu, X,
} from 'lucide-react'
import { ROLE_ACCESS, type AdminRole } from '@/lib/admin-guard'

interface Props {
  role: AdminRole
  userName: string
}

export default function AdminMobileNav({ role, userName }: Props) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const r = role

  const close = () => setOpen(false)

  return (
    <>
      {/* ── Hamburger bar (mobile only) ── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 flex h-14 items-center justify-between bg-white dark:bg-zinc-800 shadow px-4">
        <span className="text-base font-bold text-orange-500">⚡ Admin Panel</span>
        <button
          onClick={() => setOpen(true)}
          className="p-2 rounded-lg text-gray-600 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors"
          aria-label="Mở menu"
        >
          <Menu size={20} />
        </button>
      </div>

      {/* ── Spacer so content isn't hidden behind the bar ── */}
      <div className="md:hidden h-14" />

      {/* ── Overlay ── */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          onClick={close}
        />
      )}

      {/* ── Drawer ── */}
      <div
        className={`md:hidden fixed inset-y-0 left-0 z-50 w-72 flex flex-col bg-white dark:bg-zinc-800 shadow-2xl transition-transform duration-300 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex h-14 items-center justify-between border-b px-5 dark:border-zinc-700 shrink-0">
          <span className="text-base font-bold text-orange-500">⚡ Admin Panel</span>
          <button
            onClick={close}
            className="p-1.5 rounded-lg text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors"
            aria-label="Đóng menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          <NavItem href="/admin" icon={<LayoutDashboard size={16} />} label="Dashboard" pathname={pathname} onClick={close} />

          {ROLE_ACCESS.stories.includes(r) && (
            <>
              <SectionLabel label="NỘI DUNG" />
              <NavItem href="/admin/stories"      icon={<BookOpen size={16} />}  label="Quản lý Truyện"   pathname={pathname} onClick={close} />
              <NavItem href="/admin/requests"     icon={<BookPlus size={16} />}  label="Yêu cầu truyện"  pathname={pathname} onClick={close} />
              <NavItem href="/admin/voices"        icon={<Mic2 size={16} />}      label="Giọng đọc TTS"   pathname={pathname} onClick={close} />
              <NavItem href="/admin/bulk-edit"     icon={<Replace size={16} />}   label="Find & Replace"  pathname={pathname} onClick={close} />
            </>
          )}

          {ROLE_ACCESS.users.includes(r) && (
            <>
              <SectionLabel label="NGƯỜI DÙNG" />
              <NavItem href="/admin/users" icon={<Users size={16} />} label="Thành viên" pathname={pathname} onClick={close} />
            </>
          )}

          {ROLE_ACCESS.economy.includes(r) && (
            <>
              <SectionLabel label="KINH TẾ" />
              <NavItem href="/admin/economy/transactions" icon={<Coins size={16} />}       label="Giao dịch Credit"    pathname={pathname} onClick={close} />
              <NavItem href="/admin/economy/vip-plans"    icon={<ChevronRight size={16} />} label="Gói VIP"             pathname={pathname} onClick={close} />
              <NavItem href="/admin/economy/daily-tasks"  icon={<ChevronRight size={16} />} label="Nhiệm vụ hàng ngày"  pathname={pathname} onClick={close} />
            </>
          )}

          {ROLE_ACCESS.moderation.includes(r) && (
            <>
              <SectionLabel label="KIỂM DUYỆT" />
              <NavItem href="/admin/moderation/comments" icon={<MessageSquareWarning size={16} />} label="Bình luận"      pathname={pathname} onClick={close} />
              <NavItem href="/admin/moderation/reviews"  icon={<MessageSquareWarning size={16} />} label="Đánh giá"       pathname={pathname} onClick={close} />
              <NavItem href="/admin/moderation/keywords" icon={<ChevronRight size={16} />}         label="Từ khóa cấm"   pathname={pathname} onClick={close} />
            </>
          )}

          {ROLE_ACCESS.notifications.includes(r) && (
            <>
              <SectionLabel label="THÔNG BÁO" />
              <NavItem href="/admin/notifications" icon={<Bell size={16} />} label="Push Notification" pathname={pathname} onClick={close} />
            </>
          )}

          {r === 'ADMIN' && (
            <>
              <SectionLabel label="HỆ THỐNG" />
              <NavItem href="/admin/logs" icon={<ClipboardList size={16} />} label="Nhật ký Admin" pathname={pathname} onClick={close} />
            </>
          )}
        </nav>

        {/* User info */}
        <div className="p-3 border-t dark:border-zinc-700 shrink-0">
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-zinc-700/50">
            <div className="w-7 h-7 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {userName?.charAt(0)?.toUpperCase() ?? 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate dark:text-zinc-200">{userName}</p>
              <p className="text-[10px] text-orange-500 font-medium uppercase tracking-wide">{role}</p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

function SectionLabel({ label }: { label: string }) {
  return (
    <p className="px-3 pt-4 pb-1 text-[10px] font-semibold tracking-widest text-gray-400 dark:text-zinc-500 uppercase">
      {label}
    </p>
  )
}

function NavItem({
  href, icon, label, pathname, onClick,
}: {
  href: string; icon: React.ReactNode; label: string; pathname: string; onClick: () => void
}) {
  const active = pathname === href || (href !== '/admin' && pathname.startsWith(href))
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
        active
          ? 'bg-orange-50 text-orange-600 dark:bg-zinc-700 dark:text-orange-400'
          : 'text-gray-700 hover:bg-orange-50 hover:text-orange-600 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:hover:text-orange-400'
      }`}
    >
      <span className={`shrink-0 ${active ? 'text-orange-500' : 'text-gray-400 dark:text-zinc-500'}`}>{icon}</span>
      <span className="font-medium">{label}</span>
    </Link>
  )
}
