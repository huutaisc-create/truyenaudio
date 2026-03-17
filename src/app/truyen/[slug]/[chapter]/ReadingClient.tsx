'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Edit } from 'lucide-react';
import HistoryTracker from '@/components/common/HistoryTracker';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { updateChapterContent } from '@/actions/stories';

// ── Types ──────────────────────────────────────────────────────────────────
type Theme = 'sepia' | 'white' | 'green' | 'night';
type FontFamily = 'vietnam' | 'roboto' | 'lora' | 'garamond' | 'times';
type LineHeight = 'compact' | 'normal' | 'relaxed';
type ReadMode = 'scroll' | 'page';

type ReadingSettings = {
    fontSize: number;
    theme: Theme;
    fontFamily: FontFamily;
    lineHeight: LineHeight;
    readMode: ReadMode;
    modeChosen: boolean;
};

type ChapterMeta = { index: number; title: string };

type ChapterData = { id: string; index: number; title: string; content: string };

type ReadingClientProps = {
    slug: string;
    chapter: ChapterData;
    nextChapter?: ChapterData | null;
    storyTitle: string;
    storyCover?: string | null;
    prev: number | null;
    next: number | null;
    isEditable?: boolean;
    allChapters?: ChapterMeta[];
    storyId?: string;
    totalChapters?: number;
    userId?: string | null;
};

// ── Constants ──────────────────────────────────────────────────────────────
const DEFAULT_SETTINGS: ReadingSettings = {
    fontSize: 17,
    theme: 'night',
    fontFamily: 'roboto',
    lineHeight: 'compact',
    readMode: 'scroll',
    modeChosen: false,
};

const THEME_STYLES: Record<Theme, { bg: string; text: string }> = {
    sepia: { bg: '#FDFAF7', text: '#1A1208' },
    white: { bg: '#FFFFFF', text: '#1A1208' },
    green: { bg: '#F0F4F0', text: '#1A2B1A' },
    night: { bg: '#0F0A05', text: '#FFFFFF' }, // ← trắng
};

const THEME_BORDER: Record<Theme, string> = {
    sepia: 'rgba(60,30,10,0.12)',
    white: 'rgba(0,0,0,0.09)',
    green: 'rgba(30,60,30,0.12)',
    night: 'rgba(255,255,255,0.08)',
};

const FONT_STYLES: Record<FontFamily, React.CSSProperties> = {
    vietnam:  { fontFamily: 'var(--font-roboto), sans-serif' },
    roboto:   { fontFamily: 'var(--font-roboto), sans-serif' },
    lora:     { fontFamily: 'Lora, Georgia, serif' },
    garamond: { fontFamily: '"EB Garamond", Georgia, serif' },
    times:    { fontFamily: '"Times New Roman", Times, serif' },
};

const LINE_HEIGHT_MAP: Record<LineHeight, string> = {
    compact: '1.7',
    normal:  '1.9',
    relaxed: '2.1',
};

const SWATCHES: { key: Theme; bg: string; border: string }[] = [
    { key: 'sepia', bg: '#FDFAF7', border: '#EDE0D4' },
    { key: 'white', bg: '#FFFFFF', border: '#E0E0E0' },
    { key: 'green', bg: '#F0F4F0', border: '#D4E4D4' },
    { key: 'night', bg: '#0F0A05', border: '#3A2A1A' },
];

function getAccent(theme: Theme) {
    return theme === 'night' ? '#F5A623' : '#E8580A';
}

// ── Window-level cache — survive qua Next.js client navigation ────────────
// Module-level Map bị reset mỗi lần component unmount/remount khi navigate.
// Gắn vào window để cache tồn tại suốt session trình duyệt.
function getPagesCache(): Map<string, string[][]> {
    if (typeof window === 'undefined') return new Map();
    if (!(window as any).__readingPagesCache) {
        (window as any).__readingPagesCache = new Map<string, string[][]>();
    }
    return (window as any).__readingPagesCache as Map<string, string[][]>;
}
const globalPagesCache = {
    get: (k: string) => getPagesCache().get(k),
    set: (k: string, v: string[][]) => getPagesCache().set(k, v),
    has: (k: string) => getPagesCache().has(k),
};

// ── DOM-based page measurement ─────────────────────────────────────────────
// Layout thực tế:
//   header: 52px
//   footer nav: 10px padding-top + line 1px + nút ~36px + 20px padding-bottom = ~67px
//   content padding: 28px top + 12px bottom = 40px
//   safety buffer: 16px
//   title trang đầu: h1 clamp(16px,3vw,22px)*1.4 ~31px + marginBottom 14px + divider 1px + marginBottom 24px = ~70px
const HEADER_H = 52;
const FOOTER_H = 67;
const CONTENT_PAD = 40;
const SAFETY = 16;
const TITLE_H = 70; // h1 + divider + margins trang đầu

function measurePages(paragraphs: string[], settings: ReadingSettings): string[][] {
    const fontFamily = (FONT_STYLES[settings.fontFamily].fontFamily as string) || 'sans-serif';
    const marginBottomPx = settings.fontSize * 0.8; // 0.8em theo px

    const container = document.createElement('div');
    container.style.cssText = `
        position: fixed; top: -9999px; left: 0;
        width: min(680px, 100vw);
        padding: 0 28px;
        font-size: ${settings.fontSize}px;
        line-height: ${LINE_HEIGHT_MAP[settings.lineHeight]};
        font-family: ${fontFamily};
        letter-spacing: 0.01em;
        visibility: hidden; pointer-events: none;
        box-sizing: border-box;
    `;
    document.body.appendChild(container);

    const els = paragraphs.map(para => {
        const el = document.createElement('p');
        el.style.cssText = 'margin: 0; text-indent: 2em; padding: 0;';
        el.textContent = para;
        container.appendChild(el);
        return el;
    });

    // Đọc tất cả heights trong 1 batch — tránh forced reflow lặp lại
    // getBoundingClientRect() sau khi tất cả elements đã append xong
    // browser chỉ cần tính layout 1 lần cho toàn bộ container
    const rawHeights = els.map(el => el.getBoundingClientRect().height);
    document.body.removeChild(container);
    const heights = rawHeights.map(h => h + marginBottomPx);

    const viewportH = window.innerHeight;
    const PAGE_HEIGHT = viewportH - HEADER_H - FOOTER_H - CONTENT_PAD - SAFETY;
    const FIRST_PAGE_HEIGHT = PAGE_HEIGHT - TITLE_H;

    const result: string[][] = [];
    let currentPage: string[] = [];
    let usedH = 0;
    let isFirst = true;

    for (let i = 0; i < paragraphs.length; i++) {
        const maxH = isFirst ? FIRST_PAGE_HEIGHT : PAGE_HEIGHT;
        if (usedH + heights[i] > maxH && currentPage.length > 0) {
            result.push(currentPage);
            currentPage = [];
            usedH = 0;
            isFirst = false;
        }
        currentPage.push(paragraphs[i]);
        usedH += heights[i];
    }
    if (currentPage.length > 0) result.push(currentPage);
    return result.length > 0 ? result : [paragraphs];
}

function usePagination(
    paragraphs: string[],
    settings: ReadingSettings,
    contentKey: string,
) {
    const cacheKey = `${contentKey}__${settings.fontSize}__${settings.fontFamily}__${settings.lineHeight}`;

    // useState init fn chỉ chạy 1 lần lúc mount — đọc window cache ngay
    const [state, setState] = React.useState<{ pages: string[][], ready: boolean }>(() => {
        const cached = globalPagesCache.get(cacheKey);
        return cached ? { pages: cached, ready: true } : { pages: [], ready: false };
    });

    // Dùng ref để track cacheKey đã đo xong, tránh đo lại không cần thiết
    const measuredKey = React.useRef<string>(state.ready ? cacheKey : '');

    React.useEffect(() => {
        if (measuredKey.current === cacheKey) return;

        // Luôn kiểm tra cache trước (preload có thể đã chạy xong)
        const cached = globalPagesCache.get(cacheKey);
        if (cached) {
            measuredKey.current = cacheKey;
            setState({ pages: cached, ready: true });
            return;
        }

        // Chưa có cache → đo DOM
        measuredKey.current = cacheKey;
        const raf = requestAnimationFrame(() => {
            const result = measurePages(paragraphs, settings);
            globalPagesCache.set(cacheKey, result);
            setState({ pages: result, ready: true });
        });
        return () => cancelAnimationFrame(raf);
    }, [cacheKey, paragraphs]);

    return { pages: state.pages, ready: state.ready };
}

// ── Render paragraphs ──────────────────────────────────────────────────────
function RenderParagraphs({ content, text, borderColor, style }: { content: string | string[]; text: string; borderColor: string; style?: React.CSSProperties }) {
    const lines = Array.isArray(content) ? content : content.split('\n').filter(p => p.trim());
    return (
        <>
            {lines.map((para, i) => {
                if (/^[-–—*✦•]{3,}$/.test(para.trim())) {
                    return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '28px 0', opacity: 0.25 }}>
                            <div style={{ flex: 1, height: 1, background: borderColor }} />
                            <span>✦ ✦ ✦</span>
                            <div style={{ flex: 1, height: 1, background: borderColor }} />
                        </div>
                    );
                }
                return <p key={i} style={{ marginBottom: '0.8em', textIndent: '2em', ...style }}>{para}</p>;
            })}
        </>
    );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function ReadingClient({
    slug, chapter, nextChapter, storyTitle, storyCover,
    prev, next, isEditable = false,
    allChapters = [], storyId = '', totalChapters = 0, userId,
}: ReadingClientProps) {

    // Đọc settings từ localStorage ĐỒNG BỘ ngay lúc khởi tạo — tránh flash do 2 lần render
    const [settings, setSettings] = useState<ReadingSettings>(() => {
        if (typeof window === 'undefined') return DEFAULT_SETTINGS;
        try {
            const saved = localStorage.getItem('mtc_reading_settings');
            if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
        } catch {}
        return DEFAULT_SETTINGS;
    });
    const router = useRouter();
    const [mounted, setMounted] = useState(false);
    const [progress, setProgress] = useState(0);
    const [showToc, setShowToc] = useState(false);
    const [showConfig, setShowConfig] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editedContent, setEditedContent] = useState(chapter.content);
    const [currentPage, setCurrentPage] = useState(0);

    const lastScrollY = useRef(0);
    const tocRef = useRef<HTMLDivElement>(null);
    const configRef = useRef<HTMLDivElement>(null);
    // pagesCache moved to module-level globalPagesCache

    const paragraphs = editedContent.split('\n').filter(p => p.trim());
    const { pages, ready: pagesReady } = usePagination(paragraphs, settings, chapter.id);
    const totalPages = pages.length;
    const { bg, text } = THEME_STYLES[settings.theme];
    const borderColor = THEME_BORDER[settings.theme];
    const accent = getAccent(settings.theme);

    // ── Reset page về 0 khi nhảy sang chương mới ──
    const prevChapterId = useRef(chapter.id);
    useEffect(() => {
        if (prevChapterId.current !== chapter.id) {
            prevChapterId.current = chapter.id;
            setCurrentPage(0);
        }
    }, [chapter.id]);

    // ── Preload next chapter pages ──
    useEffect(() => {
        if (!nextChapter || !pagesReady) return;
        const nextParagraphs = nextChapter.content.split('\n').filter(p => p.trim());
        const nextKey = `${nextChapter.id}__${settings.fontSize}__${settings.fontFamily}__${settings.lineHeight}`;
        if (globalPagesCache.has(nextKey)) return;
        // Defer de khong anh huong den render hien tai
        const timer = setTimeout(() => {
            const result = measurePages(nextParagraphs, settings);
            globalPagesCache.set(nextKey, result);
        }, 800);
        return () => clearTimeout(timer);
    }, [nextChapter, pagesReady, settings.fontSize, settings.fontFamily, settings.lineHeight]);

    // ── setMounted để tránh hydration mismatch ──
    useEffect(() => { setMounted(true); }, []);

    // ── Save settings khi thay đổi ──
    useEffect(() => {
        if (!mounted) return;
        try { localStorage.setItem('mtc_reading_settings', JSON.stringify(settings)); } catch {}
        // TODO: if userId → POST /api/user/reading-settings
    }, [settings, mounted, userId]);

    // ── Scroll handler (chỉ track progress) ──
    const handleScroll = useCallback(() => {
        if (settings.readMode !== 'scroll') return;
        const y = window.scrollY;
        const docH = document.documentElement.scrollHeight - window.innerHeight;
        setProgress(docH > 0 ? (y / docH) * 100 : 0);
        lastScrollY.current = y;
    }, [settings.readMode]);

    useEffect(() => {
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [handleScroll]);

    // ── Page mode effects ──
    useEffect(() => {
        if (settings.readMode === 'page') {
            setProgress(totalPages > 1 ? (currentPage / (totalPages - 1)) * 100 : 100);
        }
    }, [currentPage, totalPages, settings.readMode]);

    // ── Touch swipe (page mode) ──
    const touchStartX = useRef<number | null>(null);
    const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
    const handleTouchEnd = (e: React.TouchEvent) => {
        if (touchStartX.current === null) return;
        const diff = touchStartX.current - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 50) diff > 0 ? goNext() : goPrev();
        touchStartX.current = null;
    };
    const goPrev = () => setCurrentPage(p => Math.max(0, p - 1));
    const goNext = () => setCurrentPage(p => Math.min(totalPages - 1, p + 1));

    // ── Keyboard navigation (cả 2 chế độ) ──
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Không kích hoạt khi đang gõ trong textarea/input
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return;

            const isNext = ['ArrowRight', 'ArrowDown', 'PageDown'].includes(e.key);
            const isPrev = ['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key);
            if (!isNext && !isPrev) return;
            e.preventDefault();

            if (settings.readMode === 'page') {
                // Chế độ lật trang: chỉ di chuyển trong trang, nhảy chương khi đến biên
                if (isNext) {
                    if (currentPage < totalPages - 1) goNext();
                    else if (next) router.push(`/truyen/${slug}/chuong-${next}`);
                } else {
                    if (currentPage > 0) goPrev();
                    else if (prev) router.push(`/truyen/${slug}/chuong-${prev}`);
                }
            } else {
                // Chế độ cuộn dọc: nhảy thẳng chương
                if (isNext && next) router.push(`/truyen/${slug}/chuong-${next}`);
                if (isPrev && prev) router.push(`/truyen/${slug}/chuong-${prev}`);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [settings.readMode, currentPage, totalPages, next, prev, slug, router]);

    // ── Close panels on outside click ──
    useEffect(() => {
        const h = (e: MouseEvent) => {
            if (tocRef.current && !tocRef.current.contains(e.target as Node)) setShowToc(false);
            if (configRef.current && !configRef.current.contains(e.target as Node)) setShowConfig(false);
        };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);

    const handleSave = async () => {
        const result = await updateChapterContent(chapter.id, editedContent);
        if (result.success) setIsEditing(false);
        else alert('Lỗi lưu nội dung!');
    };

    const update = <K extends keyof ReadingSettings>(key: K, val: ReadingSettings[K]) =>
        setSettings(prev => ({ ...prev, [key]: val }));

    const chooseMode = (mode: ReadMode) => {
        setSettings(prev => ({ ...prev, readMode: mode, modeChosen: true }));
        setCurrentPage(0);
    };

    const toggleToc = (e: React.MouseEvent) => { e.stopPropagation(); setShowToc(v => !v); setShowConfig(false); };
    const toggleConfig = (e: React.MouseEvent) => { e.stopPropagation(); setShowConfig(v => !v); setShowToc(false); };

    // ── Shared nav button styles ──
    const navBase: React.CSSProperties = {
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '8px 20px', borderRadius: 100,
        border: `1.5px solid ${borderColor}`,
        background: 'transparent', color: text,
        fontFamily: 'var(--font-roboto), sans-serif',
        fontSize: 12, fontWeight: 700,
        cursor: 'pointer', textDecoration: 'none',
        opacity: 0.8, transition: 'all 0.2s',
    };
    const navPrimary: React.CSSProperties = {
        ...navBase, background: accent, borderColor: accent,
        color: '#fff', opacity: 1,
        boxShadow: `0 4px 14px ${accent}40`,
    };
    const hdrBtn: React.CSSProperties = {
        height: 32, padding: '0 14px', borderRadius: 100,
        border: `1.5px solid ${borderColor}`,
        background: 'transparent', color: text,
        fontFamily: 'var(--font-roboto), sans-serif',
        fontSize: 12, fontWeight: 700, cursor: 'pointer',
        whiteSpace: 'nowrap', opacity: 0.75,
        display: 'flex', alignItems: 'center', gap: 4,
    };

    // Không cần guard mounted nữa vì settings đã đọc đồng bộ từ localStorage

    // Guard mounted: suppressHydrationWarning thay cho return null — tránh flash khi navigate
    return (
        <div
            suppressHydrationWarning
            style={{ background: bg, color: text, minHeight: '100vh', transition: 'background 0.4s, color 0.4s', ...(settings.readMode === 'page' ? { overflow: 'hidden', height: '100vh' } : {}) }}
            onTouchStart={settings.readMode === 'page' ? handleTouchStart : undefined}
            onTouchEnd={settings.readMode === 'page' ? handleTouchEnd : undefined}
        >
            <HistoryTracker slug={slug} title={storyTitle} chapterIndex={chapter.index} coverImage={storyCover || null} chapterId={chapter.id} />

            {/* ── Mode selector overlay ── */}
            {mounted && !settings.modeChosen && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                    <div style={{ background: bg, borderRadius: 24, padding: '36px 32px', maxWidth: 420, width: '100%', border: `1.5px solid ${borderColor}`, boxShadow: '0 24px 60px rgba(0,0,0,0.4)', textAlign: 'center' }}>
                        <span style={{ fontFamily: 'var(--font-roboto), sans-serif', fontSize: 11, fontWeight: 800, color: accent, letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: 10 }}>
                            Chọn kiểu đọc
                        </span>
                        <h2 style={{ fontFamily: 'var(--font-roboto), sans-serif', fontSize: 20, fontWeight: 700, color: text, marginBottom: 8, lineHeight: 1.3 }}>
                            Bạn muốn đọc theo kiểu nào?
                        </h2>
                        <p style={{ fontFamily: 'var(--font-roboto), sans-serif', fontSize: 13, color: text, opacity: 0.4, marginBottom: 28 }}>
                            Có thể đổi lại bất cứ lúc nào trong Cấu hình đọc
                        </p>
                        <div style={{ display: 'flex', gap: 14 }}>
                            {[
                                { mode: 'scroll' as ReadMode, icon: '↕', label: 'Cuộn dọc', desc: 'Cuộn xuống liên tục' },
                                { mode: 'page'   as ReadMode, icon: '↔', label: 'Lật trang', desc: 'Từng trang như sách' },
                            ].map(({ mode, icon, label, desc }) => (
                                <button key={mode} onClick={() => chooseMode(mode)} style={{ flex: 1, padding: '24px 16px', border: `2px solid ${borderColor}`, borderRadius: 16, background: 'transparent', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, transition: 'all 0.2s' }}
                                    onMouseEnter={e => { const el = e.currentTarget; el.style.borderColor = accent; el.style.background = `${accent}0f`; }}
                                    onMouseLeave={e => { const el = e.currentTarget; el.style.borderColor = borderColor; el.style.background = 'transparent'; }}
                                >
                                    <span style={{ fontSize: 28, opacity: 0.6, color: text }}>{icon}</span>
                                    <div>
                                        <p style={{ fontFamily: 'var(--font-roboto), sans-serif', fontSize: 14, fontWeight: 700, color: text, marginBottom: 4 }}>{label}</p>
                                        <p style={{ fontFamily: 'var(--font-roboto), sans-serif', fontSize: 11, color: text, opacity: 0.4 }}>{desc}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Progress bar ── */}
            <div suppressHydrationWarning style={{ position: 'fixed', top: 0, left: 0, height: 3, width: `${progress}%`, zIndex: 1000, background: `linear-gradient(90deg, ${accent}, ${accent}cc)`, boxShadow: `0 0 8px ${accent}80`, transition: 'width 0.15s linear' }} />

            {/* ── Header ── */}
            <header suppressHydrationWarning data-reading-header style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', background: `${bg}dd`, borderBottom: `1px solid ${borderColor}` }}>
                <div suppressHydrationWarning style={{ height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px', gap: 6 }}>
                    {/* Quay lại */}
                    <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 5, height: 32, padding: '0 14px', borderRadius: 100, border: `1.5px solid ${borderColor}`, fontFamily: 'var(--font-roboto), sans-serif', fontSize: 12, fontWeight: 700, color: text, textDecoration: 'none', opacity: 0.75, whiteSpace: 'nowrap', flexShrink: 0 }}>
                        <ChevronLeft size={14} /> Quay lại
                    </Link>
                    {/* Tên truyện */}
                    <Link href={`/truyen/${slug}`} style={{ fontFamily: 'var(--font-roboto), sans-serif', fontSize: 11, fontWeight: 800, color: accent, letterSpacing: '0.15em', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 280, textDecoration: 'none' }}>
                        {storyTitle}
                    </Link>
                    {/* Divider */}
                    <div style={{ width: 1, height: 14, background: borderColor, opacity: 0.5, flexShrink: 0 }} />
                    {/* DS Chương + Cấu hình đọc */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative', flexShrink: 0 }}>
                        <button onClick={toggleToc} style={hdrBtn}>DS Chương</button>
                        <button onClick={toggleConfig} style={hdrBtn}>Cấu hình đọc</button>
                        <a href={`/truyen/${slug}/nghe?chuong=${chapter.index}`} style={{ ...hdrBtn, display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z"/><path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
                          </svg>
                          Nghe
                        </a>
                        <TocPanel ref={tocRef} open={showToc} chapters={allChapters} currentIndex={chapter.index} slug={slug} storyId={storyId} totalChapters={totalChapters} bg={bg} text={text} borderColor={borderColor} accent={accent} />
                        <ConfigPanel ref={configRef} open={showConfig} settings={settings} onUpdate={update} bg={bg} text={text} borderColor={borderColor} accent={accent} />
                    </div>
                </div>
            </header>

            {/* ══════════════ SCROLL MODE ══════════════ */}
            {settings.readMode === 'scroll' && (
                <div suppressHydrationWarning style={{ maxWidth: 680, margin: '0 auto', padding: '90px 24px 60px' }}>
                    {/* Chapter heading */}
                    <div style={{ textAlign: 'center', marginBottom: 52 }}>
                        <h1 style={{ fontFamily: 'var(--font-roboto), sans-serif', fontSize: 'clamp(20px,4vw,28px)', fontWeight: 700, color: text, lineHeight: 1.4, marginBottom: 24 }}>{chapter.title}</h1>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                            <div style={{ flex: 1, maxWidth: 80, height: 1, background: `linear-gradient(90deg, transparent, ${borderColor})` }} />
                            <span style={{ fontSize: 14, opacity: 0.3, color: text }}>✦</span>
                            <div style={{ flex: 1, maxWidth: 80, height: 1, background: `linear-gradient(90deg, ${borderColor}, transparent)` }} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 28 }}>
                            {prev ? <Link href={`/truyen/${slug}/chuong-${prev}`} style={navBase}><ChevronLeft size={14} />Chương trước</Link>
                                  : <span style={{ ...navBase, opacity: 0.22, cursor: 'not-allowed' }}><ChevronLeft size={14} />Chương trước</span>}
                            {next ? <Link href={`/truyen/${slug}/chuong-${next}`} style={navPrimary}>Chương tiếp<ChevronRight size={14} /></Link>
                                  : <span style={{ ...navPrimary, opacity: 0.28, cursor: 'not-allowed' }}>Chương tiếp<ChevronRight size={14} /></span>}
                        </div>
                    </div>

                    {/* Content */}
                    {isEditing ? (
                        <div>
                            <textarea value={editedContent} onChange={e => setEditedContent(e.target.value)} style={{ width: '100%', height: '60vh', padding: 16, border: `1.5px solid ${borderColor}`, borderRadius: 12, background: 'transparent', color: text, fontFamily: 'monospace', fontSize: 13, resize: 'vertical', outline: 'none' }} />
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
                                <button onClick={() => { setIsEditing(false); setEditedContent(chapter.content); }} style={{ ...navBase, opacity: 0.6 }}>Hủy bỏ</button>
                                <button onClick={handleSave} style={navPrimary}>Lưu thay đổi</button>
                            </div>
                        </div>
                    ) : (
                        <div style={{ ...FONT_STYLES[settings.fontFamily], fontSize: settings.fontSize, lineHeight: LINE_HEIGHT_MAP[settings.lineHeight], color: text, letterSpacing: '0.01em', position: 'relative' }}>
                            {isEditable && (
                                <button onClick={() => setIsEditing(true)} style={{ position: 'absolute', top: -40, right: 0, display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-roboto), sans-serif', fontSize: 11, fontWeight: 700, color: accent, background: 'transparent', border: 'none', cursor: 'pointer' }}>
                                    <Edit size={13} /> Sửa nội dung
                                </button>
                            )}
                            <RenderParagraphs content={editedContent} text={text} borderColor={borderColor} />
                        </div>
                    )}

                    {/* Bottom nav */}
                    <div style={{ marginTop: 64, paddingTop: 40, borderTop: `1px solid ${borderColor}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                        <div style={{ display: 'flex', gap: 12 }}>
                            {prev ? <Link href={`/truyen/${slug}/chuong-${prev}`} style={{ ...navBase, padding: '10px 28px' }}><ChevronLeft size={14} />Chương trước</Link>
                                  : <span style={{ ...navBase, padding: '10px 28px', opacity: 0.22, cursor: 'not-allowed' }}><ChevronLeft size={14} />Chương trước</span>}
                            {next ? <Link href={`/truyen/${slug}/chuong-${next}`} style={{ ...navPrimary, padding: '10px 28px' }}>Chương tiếp<ChevronRight size={14} /></Link>
                                  : <span style={{ ...navPrimary, padding: '10px 28px', opacity: 0.28, cursor: 'not-allowed' }}>Chương tiếp<ChevronRight size={14} /></span>}
                        </div>
                        <Link href={`/truyen/${slug}`} style={{ fontFamily: 'var(--font-roboto), sans-serif', fontSize: 12, fontWeight: 700, color: text, opacity: 0.3, textDecoration: 'none', textTransform: 'uppercase', letterSpacing: '0.05em' }}>↑ Quay lại mục lục</Link>
                    </div>
                </div>
            )}

            {/* ══════════════ PAGE MODE ══════════════ */}
            {settings.readMode === 'page' && (
                <div
                    suppressHydrationWarning
                    style={{
                        position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', paddingTop: 52,
                        opacity: pagesReady ? 1 : 0,
                        transition: 'opacity 0.18s ease',
                    }}
                >
                    {/* Spinner overlay — hiện đè lên khi chưa ready, không unmount layout */}
                    {!pagesReady && (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                            <div style={{ width: 32, height: 32, border: `3px solid ${borderColor}`, borderTopColor: accent, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                        </div>
                    )}
                    <div style={{ flex: 1, overflow: 'hidden', maxWidth: 680, width: '100%', margin: '0 auto', padding: '28px 28px 12px', display: 'flex', flexDirection: 'column' }}>
                        {currentPage === 0 && (
                            <div style={{ textAlign: 'center', marginBottom: 24 }}>
                                <h1 style={{ fontFamily: 'var(--font-roboto), sans-serif', fontSize: 'clamp(16px,3vw,22px)', fontWeight: 700, color: text, lineHeight: 1.4, marginBottom: 14 }}>{chapter.title}</h1>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                                    <div style={{ flex: 1, maxWidth: 60, height: 1, background: borderColor }} />
                                    <span style={{ fontSize: 11, opacity: 0.3, color: text }}>✦</span>
                                    <div style={{ flex: 1, maxWidth: 60, height: 1, background: borderColor }} />
                                </div>
                            </div>
                        )}
                        <div style={{ flex: 1, overflow: 'hidden', ...FONT_STYLES[settings.fontFamily], fontSize: settings.fontSize, lineHeight: LINE_HEIGHT_MAP[settings.lineHeight], color: text, letterSpacing: '0.01em' }}>
                            <RenderParagraphs content={pages[currentPage] || []} text={text} borderColor={borderColor} />
                        </div>
                    </div>

                    {/* Page footer nav */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: 680, width: '100%', margin: '0 auto', padding: '10px 28px 20px', borderTop: `1px solid ${borderColor}`, gap: 8 }}>
                        {/* Prev — flex-shrink: 0 để không bị nén */}
                        <div style={{ flexShrink: 0 }}>
                            {currentPage > 0
                                ? <button onClick={goPrev} style={{ ...navBase, padding: '8px 18px' }}><ChevronLeft size={14} />Trang trước</button>
                                : prev
                                    ? <Link href={`/truyen/${slug}/chuong-${prev}`} style={{ ...navBase, padding: '8px 18px' }}><ChevronLeft size={14} />Chương trước</Link>
                                    : <span style={{ ...navBase, padding: '8px 18px', opacity: 0.2, cursor: 'not-allowed' }}><ChevronLeft size={14} />Chương trước</span>
                            }
                        </div>
                        {/* Giữa: tên chương + số trang, truncate khi hẹp */}
                        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                            <span style={{ fontFamily: 'var(--font-roboto), sans-serif', fontSize: 11, fontWeight: 600, color: text, opacity: 0.55, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', textAlign: 'center' }}>
                                {chapter.title}
                            </span>
                            <span style={{ fontFamily: 'var(--font-roboto), sans-serif', fontSize: 10, fontWeight: 700, color: text, opacity: 0.28, flexShrink: 0 }}>
                                {currentPage + 1} / {totalPages}
                            </span>
                        </div>
                        {/* Next — flex-shrink: 0 để không bị nén */}
                        <div style={{ flexShrink: 0 }}>
                            {currentPage < totalPages - 1
                                ? <button onClick={goNext} style={{ ...navPrimary, padding: '8px 18px' }}>Trang tiếp<ChevronRight size={14} /></button>
                                : next
                                    ? <Link href={`/truyen/${slug}/chuong-${next}`} style={{ ...navPrimary, padding: '8px 18px' }}>Chương tiếp<ChevronRight size={14} /></Link>
                                    : <span style={{ ...navPrimary, padding: '8px 18px', opacity: 0.28, cursor: 'not-allowed' }}>Chương tiếp<ChevronRight size={14} /></span>
                            }
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}

// ── TOC Panel ──────────────────────────────────────────────────────────────
const TocPanel = React.forwardRef<HTMLDivElement, {
    open: boolean;
    chapters: ChapterMeta[];
    currentIndex: number;
    slug: string;
    storyId: string;
    totalChapters: number;
    bg: string; text: string; borderColor: string; accent: string;
}>(({ open, chapters: initialChapters, currentIndex, slug, storyId, totalChapters, bg, text, borderColor, accent }, ref) => {
    const [chapters, setChapters] = React.useState<ChapterMeta[]>(initialChapters);
    const [page, setPage] = React.useState(1);
    const [loading, setLoading] = React.useState(false);
    const loadingRef = React.useRef(false); // lock ngay lập tức, không chờ re-render
    const hasMore = chapters.length < totalChapters;

    // Sync nếu initialChapters thay đổi (navigate chương mới)
    React.useEffect(() => {
        setChapters(initialChapters);
        setPage(1);
    }, [storyId]);

    const loadMore = React.useCallback(async () => {
        if (loadingRef.current || !hasMore || !storyId) return;
        loadingRef.current = true;  // lock ngay, không chờ re-render
        setLoading(true);
        try {
            const nextPage = page + 1;
            const res = await fetch(`/api/chapters/toc?storyId=${storyId}&page=${nextPage}`);
            const json = await res.json();
            if (json.success) {
                setChapters(prev => [...prev, ...json.data.chapters.map((c: any) => ({
                    index: c.index,
                    title: c.title || `Chương ${c.index}`,
                }))]);
                setPage(nextPage);
            }
        } catch (e) {
            console.error('TOC load more error:', e);
        } finally {
            loadingRef.current = false;  // unlock
            setLoading(false);
        }
    }, [hasMore, storyId, page]);

    // Scroll handler — load thêm khi còn cách đáy 80px
    const handleScroll = React.useCallback((e: React.UIEvent<HTMLDivElement>) => {
        const el = e.currentTarget;
        if (el.scrollHeight - el.scrollTop - el.clientHeight < 80) {
            loadMore();
        }
    }, [loadMore]);

    return (
        <div ref={ref} style={{ position: 'absolute', top: 44, right: 0, width: 320, maxHeight: '70vh', overflowY: 'auto', background: bg, border: `1.5px solid ${borderColor}`, borderRadius: 16, padding: 16, boxShadow: '0 12px 40px rgba(0,0,0,0.28)', zIndex: 200, transform: open ? 'translateY(0) scale(1)' : 'translateY(-8px) scale(0.96)', opacity: open ? 1 : 0, pointerEvents: open ? 'all' : 'none', transition: 'all 0.2s cubic-bezier(0.34,1.56,0.64,1)' }}
            onScroll={handleScroll}
        >
            <p style={{ fontFamily: 'var(--font-roboto), sans-serif', fontSize: 10, fontWeight: 800, color: text, opacity: 0.38, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12 }}>
                ≡ Danh sách chương
                <span style={{ fontWeight: 400, marginLeft: 6, opacity: 0.5 }}>({totalChapters})</span>
            </p>
            {chapters.length === 0 && <p style={{ fontFamily: 'var(--font-roboto), sans-serif', fontSize: 13, opacity: 0.38, color: text }}>Không có dữ liệu</p>}
            {chapters.map(ch => (
                <Link key={ch.index} href={`/truyen/${slug}/chuong-${ch.index}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 8, textDecoration: 'none', borderBottom: `1px solid ${borderColor}`, background: ch.index === currentIndex ? `${accent}14` : 'transparent', color: ch.index === currentIndex ? accent : text, fontFamily: 'var(--font-roboto), sans-serif', fontSize: 13, fontWeight: ch.index === currentIndex ? 700 : 400 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, opacity: 0.35, minWidth: 28 }}>{ch.index}</span>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch.title}</span>
                </Link>
            ))}
            {loading && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
                    <div style={{ width: 18, height: 18, border: `2px solid ${borderColor}`, borderTopColor: accent, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                </div>
            )}
            {!hasMore && chapters.length > 0 && (
                <p style={{ fontFamily: 'var(--font-roboto), sans-serif', fontSize: 11, color: text, opacity: 0.25, textAlign: 'center', padding: '10px 0' }}>— Hết danh sách —</p>
            )}
        </div>
    );
});
TocPanel.displayName = 'TocPanel';

// ── Config Panel ───────────────────────────────────────────────────────────
const ConfigPanel = React.forwardRef<HTMLDivElement, { open: boolean; settings: ReadingSettings; onUpdate: <K extends keyof ReadingSettings>(key: K, val: ReadingSettings[K]) => void; bg: string; text: string; borderColor: string; accent: string }>(
    ({ open, settings, onUpdate, bg, text, borderColor, accent }, ref) => {
        const lbl: React.CSSProperties = { fontFamily: 'var(--font-roboto), sans-serif', fontSize: 11, fontWeight: 700, color: text, opacity: 0.42, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 8 };
        const row: React.CSSProperties = { marginBottom: 16 };
        const segBtn = (active: boolean): React.CSSProperties => ({
            flex: 1, padding: '7px 0', cursor: 'pointer',
            fontFamily: 'var(--font-roboto), sans-serif', fontSize: 11, fontWeight: 700,
            border: `1.5px solid ${active ? accent : borderColor}`,
            background: active ? `${accent}14` : 'transparent',
            color: active ? accent : text,
            borderRadius: 8, transition: 'all 0.15s',
        });

        return (
            <div ref={ref} style={{ position: 'absolute', top: 44, right: 0, width: 284, background: bg, border: `1.5px solid ${borderColor}`, borderRadius: 16, padding: 20, boxShadow: '0 12px 40px rgba(0,0,0,0.28)', zIndex: 200, transform: open ? 'translateY(0) scale(1)' : 'translateY(-8px) scale(0.96)', opacity: open ? 1 : 0, pointerEvents: open ? 'all' : 'none', transition: 'all 0.2s cubic-bezier(0.34,1.56,0.64,1)' }}>
                <p style={{ fontFamily: 'var(--font-roboto), sans-serif', fontSize: 10, fontWeight: 800, color: text, opacity: 0.38, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 16 }}>Aa Cấu hình đọc</p>

                {/* Kiểu đọc */}
                <div style={row}>
                    <span style={lbl}>Kiểu đọc</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => onUpdate('readMode', 'scroll')} style={segBtn(settings.readMode === 'scroll')}>↕ Cuộn dọc</button>
                        <button onClick={() => onUpdate('readMode', 'page')}   style={segBtn(settings.readMode === 'page')}>↔ Lật trang</button>
                    </div>
                    <p style={{ fontFamily: 'var(--font-roboto), sans-serif', fontSize: 10, color: text, opacity: 0.38, marginTop: 8, lineHeight: 1.6 }}>
                        ⌨️ Dùng phím <kbd style={{ padding: '1px 5px', borderRadius: 4, border: `1px solid ${borderColor}`, fontSize: 10 }}>←</kbd> <kbd style={{ padding: '1px 5px', borderRadius: 4, border: `1px solid ${borderColor}`, fontSize: 10 }}>→</kbd> để chuyển chương (cuộn dọc) hoặc lật trang / chuyển chương (lật trang).
                    </p>
                </div>

                {/* Màu nền */}
                <div style={row}>
                    <span style={lbl}>Màu nền</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                        {SWATCHES.map(s => (
                            <button key={s.key} onClick={() => onUpdate('theme', s.key)} style={{ width: 28, height: 28, borderRadius: '50%', background: s.bg, border: settings.theme === s.key ? `2.5px solid ${accent}` : `1.5px solid ${s.border}`, boxShadow: settings.theme === s.key ? `0 0 0 2px ${bg}, 0 0 0 4px ${accent}` : 'none', cursor: 'pointer', transition: 'all 0.15s' }} />
                        ))}
                    </div>
                </div>

                {/* Cỡ chữ */}
                <div style={row}>
                    <span style={lbl}>Cỡ chữ</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <button onClick={() => onUpdate('fontSize', Math.max(13, settings.fontSize - 1))} style={{ ...segBtn(false), flex: 'none', width: 32, height: 32, fontSize: 16 }}>−</button>
                        <span style={{ fontFamily: 'var(--font-roboto), sans-serif', fontSize: 13, fontWeight: 700, color: text, minWidth: 28, textAlign: 'center' }}>{settings.fontSize}</span>
                        <button onClick={() => onUpdate('fontSize', Math.min(28, settings.fontSize + 1))} style={{ ...segBtn(false), flex: 'none', width: 32, height: 32, fontSize: 16 }}>+</button>
                    </div>
                </div>

                {/* Phông chữ */}
                <div style={row}>
                    <span style={lbl}>Phông chữ</span>
                    <select value={settings.fontFamily} onChange={e => onUpdate('fontFamily', e.target.value as FontFamily)} style={{ width: '100%', padding: '7px 10px', border: `1.5px solid ${borderColor}`, borderRadius: 8, background: bg, color: text, fontFamily: 'var(--font-roboto), sans-serif', fontSize: 12, outline: 'none', cursor: 'pointer' }}>
                        <option value="roboto">Roboto (Mặc định)</option>
                        <option value="vietnam">Be Vietnam Pro</option>
                        <option value="lora">Lora (Serif)</option>
                        <option value="garamond">EB Garamond</option>
                        <option value="times">Times New Roman</option>
                    </select>
                </div>

                {/* Giãn dòng */}
                <div style={{ ...row, marginBottom: 0 }}>
                    <span style={lbl}>Giãn dòng</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                        {(['compact', 'normal', 'relaxed'] as LineHeight[]).map(lh => (
                            <button key={lh} onClick={() => onUpdate('lineHeight', lh)} style={segBtn(settings.lineHeight === lh)}>
                                {lh === 'compact' ? 'Hẹp' : lh === 'normal' ? 'Vừa' : 'Rộng'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    }
);
ConfigPanel.displayName = 'ConfigPanel';
