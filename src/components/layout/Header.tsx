"use client";

import React, { useState, useRef, useEffect } from 'react';
import { User, Menu, BookOpen, X, Home, Compass, TrendingUp, LogOut, ChevronDown, Settings } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image'; // FIX LCP
import { useSession, signOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import RealmIcon, { getRealm } from '@/components/common/RealmIcon';

import { searchStories } from '@/actions/stories';
import SearchBox from './SearchBox';

const Header = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { data: session, status } = useSession();

  const router = useRouter();
  const pathname = usePathname();

  const chaptersRead = (session?.user as any)?.chaptersRead ?? 0;
  const realm = getRealm(chaptersRead);
  const ORANGE = '#f97316';

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

  const navPill = (href: string) =>
    isActive(href)
      ? "inline-flex items-center px-3 py-1.5 rounded-full text-sm font-bold border-1.5 border border-brand-primary text-brand-primary bg-white shadow-[0_0_0_3px_rgba(249,115,22,0.08)] transition-all"
      : "inline-flex items-center px-3 py-1.5 rounded-full text-sm font-bold border border-transparent text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 hover:border-zinc-200 transition-all";

  return (
    <header className="sticky top-0 z-50 w-full border-b border-zinc-100 bg-white/95 backdrop-blur-md">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">

          {/* Logo */}
          <Link href="/" className="flex shrink-0 items-center gap-2 group" aria-label="Về trang chủ MêTruyệnChữ">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-primary shadow-sm shadow-orange-500/20 group-hover:scale-110 transition-transform">
              <BookOpen className="h-5 w-5 text-white" aria-hidden="true" />
            </div>
            <span className="text-xl font-bold tracking-tight text-brand-secondary sm:text-2xl">
              Mê<span className="text-brand-primary transition-colors group-hover:text-orange-600">Truyện</span>Chữ
            </span>
          </Link>

          <SearchBox
            className="hidden max-w-md flex-1 md:block relative"
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            showResults={showResults}
            setShowResults={setShowResults}
            results={results}
            handleSearch={handleSearch}
          />

          <div className="flex items-center gap-3">

            {/* Nav pills */}
            <nav className="hidden items-center gap-2 lg:flex" aria-label="Điều hướng chính">
              <Link href="/" className={navPill('/')}>Trang chủ</Link>
              <Link href="/tim-kiem" className={navPill('/tim-kiem')}>Thể loại</Link>
              <Link href="/xep-hang" className={navPill('/xep-hang')}>Xếp hạng</Link>
            </nav>

            <div className="h-6 w-[1px] bg-zinc-200 hidden lg:block" aria-hidden="true"></div>

            {/* User button */}
            {status === 'loading' ? (
              <div className="h-8 w-20 animate-pulse rounded-full bg-zinc-100" aria-label="Đang tải..." role="status"></div>
            ) : session ? (
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  aria-expanded={showUserMenu}
                  aria-haspopup="true"
                  aria-label={`Menu tài khoản của ${session.user?.name}`}
                  className="flex items-center gap-2 rounded-full px-2 py-1.5 hover:bg-zinc-50 border border-transparent hover:border-zinc-200 transition-all"
                >
                  <div className="relative">
                    {session.user?.image ? (
                      // FIX LCP + A11Y: next/image thay <img>, alt mô tả rõ
                      <Image
                        src={session.user.image}
                        alt={`Ảnh đại diện của ${session.user.name}`}
                        width={32}
                        height={32}
                        className="rounded-full object-cover shadow-sm"
                        style={{ border: `2px solid ${ORANGE}` }}
                      />
                    ) : (
                      <div
                        className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white shadow-sm"
                        style={{ backgroundColor: ORANGE + 'cc', border: `2px solid ${ORANGE}` }}
                        aria-hidden="true"
                      >
                        {session.user?.name?.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="absolute -bottom-1.5 -right-1.5" aria-hidden="true">
                      <RealmIcon chaptersRead={chaptersRead} size={16} />
                    </div>
                  </div>
                  <div className="hidden flex-col items-start sm:flex">
                    <span className="text-xs font-bold text-zinc-800 leading-tight">{session.user?.name}</span>
                    <span className="text-[10px] leading-tight" style={{ color: ORANGE }}>{realm.name}</span>
                  </div>
                  <ChevronDown className="h-3 w-3 text-zinc-400 hidden sm:block" aria-hidden="true" />
                </button>

                {showUserMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)} aria-hidden="true" />
                    <div
                      className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-zinc-100 bg-white shadow-xl z-20 overflow-hidden"
                      role="menu"
                      aria-label="Menu tài khoản"
                    >
                      <div className="p-3 border-b border-zinc-100" style={{ background: 'linear-gradient(145deg, #0e0e1e, #141428)' }}>
                        <div className="flex items-center gap-3">
                          <div className="shrink-0" aria-hidden="true">
                            <RealmIcon chaptersRead={chaptersRead} size={52} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-black" style={{ color: realm.color }}>{realm.name}</p>
                            <p className="text-[10px] text-zinc-500 mb-1">{realm.world} · CẤP {realm.idx + 1}</p>
                            <div className="flex gap-0.5 mb-1" aria-hidden="true">
                              {Array.from({ length: 9 }).map((_, i) => (
                                <span key={i} className="text-[10px]" style={{ color: i < realm.stars ? realm.color : '#2a2a3a' }}>★</span>
                              ))}
                            </div>
                            <p className="text-[10px] text-zinc-500">{chaptersRead.toLocaleString('vi')} chương</p>
                          </div>
                        </div>
                        {realm.nextName && (
                          <div className="mt-2">
                            <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                              <div className="h-full rounded-full" style={{ width: `${realm.progressPct}%`, background: realm.color }} />
                            </div>
                            <p className="text-[9px] mt-0.5 text-right" style={{ color: realm.color + '88' }}>còn {realm.chaptersToNext.toLocaleString('vi')} → {realm.nextName}</p>
                          </div>
                        )}
                      </div>
                      <Link role="menuitem" href="/tai-khoan" onClick={() => setShowUserMenu(false)} className="flex items-center gap-3 px-4 py-3 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors">
                        <User className="h-4 w-4" aria-hidden="true" /> Trang cá nhân
                      </Link>
                      <Link role="menuitem" href="/tai-khoan/cai-dat" onClick={() => setShowUserMenu(false)} className="flex items-center gap-3 px-4 py-3 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors border-t border-zinc-50">
                        <Settings className="h-4 w-4" aria-hidden="true" /> Đổi ảnh đại diện
                      </Link>
                      <button
                        role="menuitem"
                        onClick={() => { setShowUserMenu(false); signOut(); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-zinc-700 hover:bg-red-50 hover:text-red-500 transition-colors border-t border-zinc-100"
                      >
                        <LogOut className="h-4 w-4" aria-hidden="true" /> Đăng xuất
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <Link href="/login">
                <button className="flex items-center gap-2 rounded-full px-3 py-1.5 border border-zinc-200 text-sm font-bold text-zinc-700 transition-all hover:text-brand-primary hover:border-brand-primary active:scale-95">
                  <User className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:inline">Đăng nhập</span>
                </button>
              </Link>
            )}

            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Mở menu di động"
              aria-expanded={isMenuOpen}
              className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 md:hidden transition-all active:scale-90"
            >
              <Menu className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>
        </div>

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

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-[999] md:hidden" role="dialog" aria-modal="true" aria-label="Menu di động">
          <div className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm" onClick={() => setIsMenuOpen(false)} aria-hidden="true" />
          <div className="absolute right-0 top-0 h-[100dvh] w-[280px] bg-white shadow-2xl flex flex-col">
            <div className="shrink-0 p-4 border-b border-zinc-100 flex items-center justify-between">
              <span className="font-black text-zinc-800 tracking-tighter italic">DANH MỤC</span>
              <button onClick={() => setIsMenuOpen(false)} aria-label="Đóng menu" className="p-2 rounded-full hover:bg-zinc-100 text-zinc-600 hover:text-red-500 transition-colors">
                <X className="h-6 w-6" aria-hidden="true" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-2 bg-white" aria-label="Menu di động">
              <Link href="/" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-4 p-4 rounded-xl font-bold text-zinc-700 hover:bg-orange-50 hover:text-brand-primary transition-all"><Home className="h-5 w-5" aria-hidden="true" /> Trang chủ</Link>
              <Link href="/tim-kiem" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-4 p-4 rounded-xl font-bold text-zinc-700 hover:bg-orange-50 hover:text-brand-primary transition-all"><Compass className="h-5 w-5" aria-hidden="true" /> Thể loại</Link>
              <Link href="/xep-hang" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-4 p-4 rounded-xl font-bold text-zinc-700 hover:bg-orange-50 hover:text-brand-primary transition-all"><TrendingUp className="h-5 w-5" aria-hidden="true" /> Xếp hạng</Link>
              <div className="my-2 border-t border-zinc-100" aria-hidden="true"></div>
              {session ? (
                <>
                  <div className="rounded-xl overflow-hidden mb-2">
                    <div className="p-3" style={{ background: 'linear-gradient(145deg, #0e0e1e, #141428)', border: `1px solid ${realm.color}44` }}>
                      <div className="flex items-center gap-3">
                        {session.user?.image ? (
                          <Image
                            src={session.user.image}
                            alt={`Ảnh đại diện của ${session.user.name}`}
                            width={40}
                            height={40}
                            className="rounded-full object-cover shrink-0"
                            style={{ border: `2px solid ${ORANGE}` }}
                          />
                        ) : (
                          <div className="h-10 w-10 flex items-center justify-center rounded-full text-sm font-bold text-white shrink-0" style={{ backgroundColor: ORANGE + 'cc' }} aria-hidden="true">
                            {session.user?.name?.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1">
                          <p className="text-sm font-bold text-white">{session.user?.name}</p>
                          <p className="text-xs font-semibold" style={{ color: realm.color }}>{realm.name}</p>
                        </div>
                        <div aria-hidden="true"><RealmIcon chaptersRead={chaptersRead} size={40} /></div>
                      </div>
                      <div className="flex gap-0.5 mt-2" aria-hidden="true">
                        {Array.from({ length: 9 }).map((_, i) => (
                          <span key={i} className="text-xs" style={{ color: i < realm.stars ? realm.color : '#2a2a3a' }}>★</span>
                        ))}
                      </div>
                      <p className="text-[10px] text-zinc-500 mt-1">{chaptersRead.toLocaleString('vi')} chương đã đọc</p>
                    </div>
                  </div>
                  <Link href="/tai-khoan" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-4 p-4 rounded-xl font-bold text-zinc-700 hover:bg-orange-50 hover:text-brand-primary transition-all"><User className="h-5 w-5" aria-hidden="true" /> Trang cá nhân</Link>
                  <Link href="/tai-khoan/cai-dat" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-4 p-4 rounded-xl font-bold text-zinc-700 hover:bg-orange-50 hover:text-brand-primary transition-all"><Settings className="h-5 w-5" aria-hidden="true" /> Đổi ảnh đại diện</Link>
                  <button onClick={() => { setIsMenuOpen(false); signOut(); }} className="w-full flex items-center gap-4 p-4 rounded-xl font-bold text-zinc-700 hover:bg-red-50 hover:text-red-500 transition-all text-left"><LogOut className="h-5 w-5" aria-hidden="true" /> Đăng xuất</button>
                </>
              ) : (
                <Link href="/login" onClick={() => setIsMenuOpen(false)}>
                  <button className="w-full flex items-center gap-4 p-4 rounded-xl font-bold text-zinc-700 hover:bg-orange-50 hover:text-brand-primary transition-all text-left"><User className="h-5 w-5" aria-hidden="true" /> Đăng nhập</button>
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
