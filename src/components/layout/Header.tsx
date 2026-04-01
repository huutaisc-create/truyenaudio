"use client";

import React, { useState, useEffect, useRef } from 'react';
import { User, Menu, X, Home, Compass, TrendingUp, LogOut, ChevronDown, Settings } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useSession, signOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import RealmIcon, { getRealm } from '@/components/common/RealmIcon';
import { searchStories } from '@/actions/stories';
import SearchBox from './SearchBox';

// ── Theme Toggle ───────────────────────────────────────────────
// Đọc/ghi vào localStorage key 'mtc-theme', đổi data-theme trên <html>
function useTheme() {
  const [theme, setTheme] = useState<'male' | 'female'>('male');

  useEffect(() => {
    // Đọc theme đã lưu (script inline trong layout đã set attribute rồi)
    const saved = localStorage.getItem('mtc-theme') as 'male' | 'female' | null;
    const current = document.documentElement.getAttribute('data-theme') as 'male' | 'female';
    setTheme(saved || current || 'male');
  }, []);

  const toggle = (t: 'male' | 'female') => {
    setTheme(t);
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('mtc-theme', t);
  };

  return { theme, toggle };
}

const Header = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { data: session, status } = useSession();
  const { theme, toggle } = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  const chaptersRead = (session?.user as any)?.chaptersRead ?? 0;
  const realm = getRealm(chaptersRead);



  React.useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.trim().length > 0) {
        try {
          const res = await searchStories({ keyword: searchQuery, page: 1 });
          if (res && res.data) setResults(res.data.slice(0, 5));
        } catch (error) { console.error(error); }
      } else { setResults([]); }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSearch = () => {
    if (searchQuery.trim()) {
      setShowResults(false);
      router.push(`/tim-kiem?tu-khoa=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  // Nav pill — dark version
  const navPill = (href: string) =>
    isActive(href)
      ? "inline-flex items-center px-3 py-1.5 rounded-full text-sm font-bold border-[1.5px] border-[var(--accent)] text-[var(--accent)] bg-transparent transition-all"
      : "inline-flex items-center px-3 py-1.5 rounded-full text-sm font-bold border border-transparent text-[var(--text-muted)] hover:text-[var(--text)] transition-all";

  return (
    <header
      className="sticky top-0 z-50 w-full"
      style={{
        background: 'var(--nav-bg)',
        borderBottom: '1px solid var(--border)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-[60px] items-center justify-between gap-4">

          {/* ── Logo ── */}
          <Link
            href="/"
            className="flex shrink-0 items-center group"
            aria-label="Về trang chủ"
          >
            <Image
              src="/logo-chinh.svg"
              alt="Truyen Audio Của Tôi"
              width={160}
              height={50}
              className="group-hover:scale-105 transition-transform"
              priority
            />
          </Link>

          {/* ── Search (desktop) ── */}
          <SearchBox
            className="hidden max-w-md flex-1 md:block relative"
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            showResults={showResults}
            setShowResults={setShowResults}
            results={results}
            handleSearch={handleSearch}
          />

          <div className="flex items-center gap-2 lg:gap-3">

            {/* ── Nav pills (desktop) ── */}
            <nav className="hidden items-center gap-1 lg:flex" aria-label="Điều hướng chính">
              <Link href="/" className={navPill('/')}>Trang chủ</Link>
              <Link href="/tim-kiem" className={navPill('/tim-kiem')}>Thể loại</Link>
              <Link href="/xep-hang" className={navPill('/xep-hang')}>Xếp hạng</Link>
              {session && (
                <Link
                  href="/tai-khoan/credits"
                  className={
                    isActive('/tai-khoan/credits')
                      ? "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold border transition-all"
                      : "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold border border-transparent transition-all"
                  }
                  style={isActive('/tai-khoan/credits')
                    ? { borderColor: 'var(--accent2)', color: 'var(--accent2)', background: 'var(--accent2-soft)' }
                    : { color: 'var(--accent2)' }
                  }
                >
                  <span aria-hidden="true">⚡</span> Credits
                </Link>
              )}
            </nav>

            {/* ── Divider ── */}
            <div
              className="hidden lg:block h-5 w-px"
              style={{ background: 'var(--border)' }}
              aria-hidden="true"
            />

            {/* ── Theme Toggle ── */}
            <div
              className="hidden lg:flex items-center gap-[3px] rounded-full p-[3px]"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              role="group"
              aria-label="Chọn giao diện"
            >
              <button
                onClick={() => toggle('male')}
                aria-pressed={theme === 'male'}
                className="rounded-full px-3 py-[5px] text-[11px] font-bold transition-all whitespace-nowrap cursor-pointer"
                style={theme === 'male'
                  ? { background: 'var(--accent)', color: '#fff' }
                  : { background: 'transparent', color: 'var(--text-muted)' }
                }
              >
                ⚔ Nam
              </button>
              <button
                onClick={() => toggle('female')}
                aria-pressed={theme === 'female'}
                className="rounded-full px-3 py-[5px] text-[11px] font-bold transition-all whitespace-nowrap cursor-pointer"
                style={theme === 'female'
                  ? { background: 'var(--accent)', color: '#fff' }
                  : { background: 'transparent', color: 'var(--text-muted)' }
                }
              >
                ✦ Nữ
              </button>
            </div>

            {/* ── Divider ── */}
            <div
              className="hidden lg:block h-5 w-px"
              style={{ background: 'var(--border)' }}
              aria-hidden="true"
            />

            {/* ── User button ── */}
            {status === 'loading' ? (
              <div
                className="h-8 w-20 animate-pulse rounded-full"
                style={{ background: 'var(--card)' }}
                aria-label="Đang tải..."
                role="status"
              />
            ) : session ? (
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  aria-expanded={showUserMenu}
                  aria-haspopup="true"
                  aria-label={`Menu tài khoản của ${session.user?.name}`}
                  className="flex items-center gap-2 rounded-full px-2 py-1.5 transition-all"
                  style={{ border: '1px solid var(--border)' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                >
                  <div className="relative">
                    {session.user?.image ? (
                      <Image
                        src={session.user.image}
                        alt={`Ảnh đại diện của ${session.user.name}`}
                        width={28}
                        height={28}
                        className="rounded-full object-cover"
                        style={{ border: `2px solid var(--accent)` }}
                      />
                    ) : (
                      <div
                        className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white"
                        style={{ background: `linear-gradient(135deg, var(--accent), var(--accent2))` }}
                        aria-hidden="true"
                      >
                        {session.user?.name?.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="hidden sm:block text-left">
                    <div className="text-xs font-semibold leading-none" style={{ color: 'var(--text)' }}>
                      {session.user?.name?.split(' ').slice(-1)[0]}
                    </div>
                    <div className="text-[10px] mt-0.5 font-semibold" style={{ color: 'var(--accent2)' }}>
                      {realm.name}
                    </div>
                  </div>
                  <ChevronDown className="h-3 w-3 hidden sm:block" style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
                </button>

                {/* Dropdown */}
                {showUserMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} aria-hidden="true" />
                    <div
                      className="absolute right-0 top-full mt-2 w-64 rounded-xl shadow-2xl z-50 overflow-hidden"
                      role="menu"
                      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                    >
                      {/* User info header */}
                      <div className="p-4" style={{ background: 'linear-gradient(145deg, var(--card2), var(--card))', borderBottom: '1px solid var(--border)' }}>
                        <div className="flex items-center gap-3">
                          {session.user?.image ? (
                            <Image
                              src={session.user.image}
                              alt={`Ảnh đại diện của ${session.user.name}`}
                              width={40}
                              height={40}
                              className="rounded-full object-cover shrink-0"
                              style={{ border: `2px solid var(--accent)` }}
                            />
                          ) : (
                            <div
                              className="h-10 w-10 flex items-center justify-center rounded-full text-sm font-bold text-white shrink-0"
                              style={{ background: `linear-gradient(135deg, var(--accent), var(--accent2))` }}
                              aria-hidden="true"
                            >
                              {session.user?.name?.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold truncate" style={{ color: 'var(--text)' }}>{session.user?.name}</p>
                            <p className="text-xs font-semibold" style={{ color: 'var(--accent2)' }}>{realm.name}</p>
                          </div>
                          <div aria-hidden="true"><RealmIcon chaptersRead={chaptersRead} size={36} /></div>
                        </div>
                        <div className="flex gap-0.5 mt-2" aria-hidden="true">
                          {Array.from({ length: 9 }).map((_, i) => (
                            <span key={i} className="text-[10px]" style={{ color: i < realm.stars ? realm.color : 'var(--border)' }}>★</span>
                          ))}
                        </div>
                        {realm.nextName && (
                          <div className="mt-2">
                            <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                              <div className="h-full rounded-full transition-all" style={{ width: `${realm.progressPct}%`, background: realm.color }} />
                            </div>
                            <p className="text-[9px] mt-0.5 text-right" style={{ color: 'var(--accent2)', opacity: 0.55 }}>còn {realm.chaptersToNext?.toLocaleString('vi')} → {realm.nextName}</p>
                          </div>
                        )}
                        <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>{chaptersRead.toLocaleString('vi')} chương</p>
                      </div>

                      <Link role="menuitem" href="/tai-khoan" onClick={() => setShowUserMenu(false)}
                        className="flex items-center gap-3 px-4 py-3 text-sm transition-colors"
                        style={{ color: 'var(--text)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--card)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <User className="h-4 w-4" aria-hidden="true" /> Trang cá nhân
                      </Link>
                      <Link role="menuitem" href="/tai-khoan/credits" onClick={() => setShowUserMenu(false)}
                        className="flex items-center gap-3 px-4 py-3 text-sm transition-colors"
                        style={{ color: 'var(--accent2)', borderTop: '1px solid var(--border-soft)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent2-soft)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <span className="text-base leading-none" aria-hidden="true">⚡</span> Credits của tôi
                      </Link>
                      <Link role="menuitem" href="/tai-khoan/cai-dat" onClick={() => setShowUserMenu(false)}
                        className="flex items-center gap-3 px-4 py-3 text-sm transition-colors"
                        style={{ color: 'var(--text)', borderTop: '1px solid var(--border-soft)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--card)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <Settings className="h-4 w-4" aria-hidden="true" /> Đổi ảnh đại diện
                      </Link>
                      <button
                        role="menuitem"
                        onClick={() => { setShowUserMenu(false); signOut(); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors text-left"
                        style={{ color: 'var(--text)', borderTop: '1px solid var(--border)' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(220,38,38,0.08)'; e.currentTarget.style.color = '#ef4444'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text)'; }}
                      >
                        <LogOut className="h-4 w-4" aria-hidden="true" /> Đăng xuất
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <Link href="/login" aria-label="Đăng nhập">
                <button
                  className="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold transition-all active:scale-95"
                  style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                >
                  <User className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden sm:inline">Đăng nhập</span>
                </button>
              </Link>
            )}

            {/* ── Mobile menu button ── */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Mở menu di động"
              aria-expanded={isMenuOpen}
              className="rounded-lg p-2 transition-all active:scale-90 md:hidden"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--card)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <Menu className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* ── Search (mobile) ── */}
        <SearchBox
          className="pb-3 md:hidden relative"
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          showResults={showResults}
          setShowResults={setShowResults}
          results={results}
          handleSearch={handleSearch}
        />
      </div>

      {/* ── Mobile Menu ── */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-[999] md:hidden" role="dialog" aria-modal="true" aria-label="Menu di động">
          <div
            className="absolute inset-0 backdrop-blur-sm"
            style={{ background: 'rgba(0,0,0,0.7)' }}
            onClick={() => setIsMenuOpen(false)}
            aria-hidden="true"
          />
          <div
            className="absolute right-0 top-0 h-[100dvh] w-[280px] flex flex-col shadow-2xl"
            style={{ background: 'var(--surface)', borderLeft: '1px solid var(--border)' }}
          >
            {/* Mobile header */}
            <div className="shrink-0 p-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
              <span className="font-black tracking-tighter italic" style={{ color: 'var(--text)' }}>DANH MỤC</span>
              <button
                onClick={() => setIsMenuOpen(false)}
                aria-label="Đóng menu"
                className="p-2 rounded-full transition-colors"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
              >
                <X className="h-6 w-6" aria-hidden="true" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1" aria-label="Menu di động">
              {[
                { href: '/', icon: <Home className="h-5 w-5" />, label: 'Trang chủ' },
                { href: '/tim-kiem', icon: <Compass className="h-5 w-5" />, label: 'Thể loại' },
                { href: '/xep-hang', icon: <TrendingUp className="h-5 w-5" />, label: 'Xếp hạng' },
              ].map(({ href, icon, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center gap-4 p-4 rounded-xl font-bold transition-all"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--card)'; e.currentTarget.style.color = 'var(--accent)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                >
                  {icon} {label}
                </Link>
              ))}

              <div className="my-2 border-t" style={{ borderColor: 'var(--border)' }} aria-hidden="true" />

              {/* Mobile theme toggle */}
              <div className="px-2 py-3">
                <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Giao diện</p>
                <div
                  className="flex items-center gap-[3px] rounded-full p-[3px] w-full"
                  style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
                >
                  <button
                    onClick={() => toggle('male')}
                    className="flex-1 rounded-full py-2 text-xs font-bold transition-all"
                    style={theme === 'male'
                      ? { background: 'var(--accent)', color: '#fff' }
                      : { background: 'transparent', color: 'var(--text-muted)' }
                    }
                  >
                    ⚔ Nam
                  </button>
                  <button
                    onClick={() => toggle('female')}
                    className="flex-1 rounded-full py-2 text-xs font-bold transition-all"
                    style={theme === 'female'
                      ? { background: 'var(--accent)', color: '#fff' }
                      : { background: 'transparent', color: 'var(--text-muted)' }
                    }
                  >
                    ✦ Nữ
                  </button>
                </div>
              </div>

              <div className="my-2 border-t" style={{ borderColor: 'var(--border)' }} aria-hidden="true" />

              {/* User section mobile */}
              {session ? (
                <>
                  <div className="rounded-xl overflow-hidden mb-2">
                    <div className="p-3" style={{ background: 'linear-gradient(145deg, var(--card2), var(--card))', border: `1px solid ${realm.color}44` }}>
                      <div className="flex items-center gap-3">
                        {session.user?.image ? (
                          <Image
                            src={session.user.image}
                            alt={`Ảnh đại diện của ${session.user.name}`}
                            width={40}
                            height={40}
                            className="rounded-full object-cover shrink-0"
                            style={{ border: `2px solid var(--accent)` }}
                          />
                        ) : (
                          <div
                            className="h-10 w-10 flex items-center justify-center rounded-full text-sm font-bold text-white shrink-0"
                            style={{ background: `linear-gradient(135deg, var(--accent), var(--accent2))` }}
                            aria-hidden="true"
                          >
                            {session.user?.name?.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1">
                          <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>{session.user?.name}</p>
                          <p className="text-xs font-semibold" style={{ color: 'var(--accent2)' }}>{realm.name}</p>
                        </div>
                        <div aria-hidden="true"><RealmIcon chaptersRead={chaptersRead} size={40} /></div>
                      </div>
                      <div className="flex gap-0.5 mt-2" aria-hidden="true">
                        {Array.from({ length: 9 }).map((_, i) => (
                          <span key={i} className="text-xs" style={{ color: i < realm.stars ? realm.color : 'var(--border)' }}>★</span>
                        ))}
                      </div>
                      <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>{chaptersRead.toLocaleString('vi')} chương đã đọc</p>
                    </div>
                  </div>
                  <Link href="/tai-khoan" onClick={() => setIsMenuOpen(false)}
                    className="flex items-center gap-4 p-4 rounded-xl font-bold transition-all"
                    style={{ color: 'var(--text-muted)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--card)'; e.currentTarget.style.color = 'var(--accent)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                  >
                    <User className="h-5 w-5" aria-hidden="true" /> Trang cá nhân
                  </Link>
                  <Link href="/tai-khoan/credits" onClick={() => setIsMenuOpen(false)}
                    className="flex items-center gap-4 p-4 rounded-xl font-bold transition-all"
                    style={{ color: 'var(--accent2)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent2-soft)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span className="text-lg leading-none" aria-hidden="true">⚡</span> Credits của tôi
                  </Link>
                  <Link href="/tai-khoan/cai-dat" onClick={() => setIsMenuOpen(false)}
                    className="flex items-center gap-4 p-4 rounded-xl font-bold transition-all"
                    style={{ color: 'var(--text-muted)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--card)'; e.currentTarget.style.color = 'var(--accent)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                  >
                    <Settings className="h-5 w-5" aria-hidden="true" /> Đổi ảnh đại diện
                  </Link>
                  <button
                    onClick={() => { setIsMenuOpen(false); signOut(); }}
                    className="w-full flex items-center gap-4 p-4 rounded-xl font-bold transition-all text-left"
                    style={{ color: 'var(--text-muted)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(220,38,38,0.08)'; e.currentTarget.style.color = '#ef4444'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                  >
                    <LogOut className="h-5 w-5" aria-hidden="true" /> Đăng xuất
                  </button>
                </>
              ) : (
                <Link href="/login" onClick={() => setIsMenuOpen(false)} aria-label="Đăng nhập">
                  <button
                    className="w-full flex items-center gap-4 p-4 rounded-xl font-bold transition-all text-left"
                    style={{ color: 'var(--text-muted)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--card)'; e.currentTarget.style.color = 'var(--accent)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                  >
                    <User className="h-5 w-5" aria-hidden="true" /> Đăng nhập
                  </button>
                </Link>
              )}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
