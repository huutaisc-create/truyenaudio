"use client";

import React, { useState, Suspense } from 'react';
import { Filter, Search, ChevronDown, Check, BookOpen, User, Star, RotateCcw, Eye, Heart, Bookmark, Award, X } from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import { formatNumber } from '@/lib/utils';

// Tình trạng & số chương vẫn hardcode vì không lưu trong DB Genre
const TINH_TRANG = ["Đang Ra", "Hoàn Thành", "Dịch", "Convert"];
const SO_CHUONG  = ["< 200", "200 - 400", "400 - 600", "600 - 800", "800 - 1000", "> 1000"];

// --- HELPER COMPONENTS ---
const FilterSection = ({
    title,
    items,
    selectedItems,
    onToggle
}: {
    title: string;
    items: string[];
    selectedItems: string[];
    onToggle: (item: string) => void;
}) => (
    <div className="flex flex-col sm:flex-row gap-4 border-b border-dashed border-zinc-100 py-4 last:border-0">
        <div className="w-32 shrink-0 pt-1">
            <span className="text-sm font-bold text-zinc-800 uppercase tracking-wide">{title}</span>
        </div>
        <div className="flex-1 flex flex-wrap gap-2">
            {items.map(item => {
                const isSelected = selectedItems.includes(item);
                return (
                    <button
                        key={item}
                        onClick={() => onToggle(item)}
                        className={`px-3 py-1.5 rounded text-[13px] font-medium transition-all ${isSelected
                            ? 'bg-brand-primary text-white shadow-sm shadow-orange-500/20'
                            : 'text-zinc-600 hover:text-brand-primary hover:bg-zinc-50'
                            }`}
                    >
                        {item}
                    </button>
                );
            })}
        </div>
    </div>
);

import { searchStories, getGenres } from '@/actions/stories';


const FilterPage = () => {
    const searchParams = useSearchParams();
    const router = useRouter();
    const keyword = searchParams.get('tu-khoa');
    const theLoaiParam = searchParams.get('the-loai');

    // Local search input state — pre-fill với keyword từ URL
    const [localKeyword, setLocalKeyword] = React.useState(keyword || '');

    // Sync khi URL keyword thay đổi (navigate từ header)
    React.useEffect(() => {
        setLocalKeyword(keyword || '');
    }, [keyword]);

    // Khi user gõ vào ô search → update URL → trigger fetch
    const handleLocalSearch = (val: string) => {
        setLocalKeyword(val);
        const params = new URLSearchParams(searchParams.toString());
        if (val.trim()) {
            params.set('tu-khoa', val.trim());
        } else {
            params.delete('tu-khoa');
        }
        params.delete('page');
        router.replace(`/tim-kiem?${params.toString()}`);
    };

    // Hỗ trợ nhiều genre cách nhau bằng dấu phẩy: ?the-loai=Ngôn+Tình,Sủng
    const theLoaiInitial = theLoaiParam
        ? theLoaiParam.split(',').map(g => g.trim()).filter(Boolean)
        : [] as string[]

    // Khởi tạo filter với the-loai từ URL nếu có
    const [filters, setFilters] = useState({
        theLoai: theLoaiInitial,
        boiCanh: [] as string[],
        tinhCach: [] as string[],
        luuPhai: [] as string[],
        thiGiac: [] as string[],
        tinhTrang: [] as string[],
        soChuong: [] as string[]
    });

    // Genres từ DB
    const [genreData, setGenreData] = useState<Record<string, string[]>>({});
    React.useEffect(() => {
        getGenres().then(setGenreData);
    }, []);
    const theLoaiList = genreData['GENRE']    || [];
    const boiCanhList = genreData['BOI_CANH'] || [];
    const luuPhaiList = genreData['LUU_PHAI'] || [];
    const tinhCachList= genreData['TINH_CACH']|| [];
    const thiGiacList = genreData['THI_GIAC'] || [];

    const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
    const [timeFilter, setTimeFilter] = useState<{ type: 'all' | 'specific'; month: number; year: number }>({
        type: 'all',
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear()
    });
    const [sortBy, setSortBy] = useState('hot');

    // Data State
    const [stories, setStories] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });

    // Khi URL param thay đổi (navigate từ trang khác), sync vào filter
    const prevTheLoaiParam = React.useRef(theLoaiParam);
    React.useEffect(() => {
        if (theLoaiParam !== prevTheLoaiParam.current) {
            prevTheLoaiParam.current = theLoaiParam;
            const genres = theLoaiParam
                ? theLoaiParam.split(',').map(g => g.trim()).filter(Boolean)
                : []
            setFilters(prev => ({ ...prev, theLoai: genres }));
            setPage(1);
        }
    }, [theLoaiParam]);

    // Helper: parse chapter range
    const parseChapterRange = (ranges: string[]) => {
        if (ranges.length === 0) return { min: undefined, max: undefined };
        let min = Infinity, max = -Infinity;
        ranges.forEach(r => {
            if (r.startsWith('<')) { min = Math.min(min, 0); max = Math.max(max, parseInt(r.replace('<','').trim())); }
            else if (r.startsWith('>')) { min = Math.min(min, parseInt(r.replace('>','').trim())); max = Math.max(max, 999999); }
            else { const p = r.split('-').map(x => parseInt(x.trim())); if (p.length === 2) { min = Math.min(min, p[0]); max = Math.max(max, p[1]); } }
        });
        return { min: min === Infinity ? undefined : min, max: max === -Infinity ? undefined : max };
    };

    // Fetch — chạy khi filters, sortBy, timeFilter, keyword, page thay đổi
    const isFirstRender = React.useRef(true);
    React.useEffect(() => {
        const delay = isFirstRender.current ? 0 : 300;
        isFirstRender.current = false;

        const timer = setTimeout(async () => {
            setLoading(true);
            setStories([]);
            try {
                const { min, max } = parseChapterRange(filters.soChuong);
                const res = await searchStories({
                    keyword:     keyword || undefined,
                    genres:      filters.theLoai,
                    boiCanh:     filters.boiCanh,
                    luuPhai:     filters.luuPhai,
                    tinhCach:    filters.tinhCach,
                    thiGiac:     filters.thiGiac,
                    status:      filters.tinhTrang,
                    minChapters: min,
                    maxChapters: max,
                    sortBy,
                    page,
                    month: timeFilter.type === 'specific' ? timeFilter.month : undefined,
                    year:  timeFilter.type === 'specific' ? timeFilter.year  : undefined,
                });
                setStories(res.data);
                setPagination(res.pagination);
            } catch (e) {
                console.error('Failed to fetch stories', e);
                setPagination({ total: 0, totalPages: 0 });
            } finally {
                setLoading(false);
            }
        }, delay);
        return () => clearTimeout(timer);
    }, [filters, sortBy, timeFilter, keyword, page]);

    // Toggle filter — reset page
    const toggleFilter = (category: keyof typeof filters, item: string) => {
        setPage(1);
        setFilters(prev => {
            const list = prev[category];
            return { ...prev, [category]: list.includes(item) ? list.filter(i => i !== item) : [...list, item] };
        });
    };

    const resetFilters = () => {
        setFilters({ theLoai: [], boiCanh: [], tinhCach: [], luuPhai: [], thiGiac: [], tinhTrang: [], soChuong: [] });
        setTimeFilter({ type: 'all', month: new Date().getMonth() + 1, year: new Date().getFullYear() });
        setPage(1);
    };

    // --- HELPER COMPONENTS FOR SIDEBAR ---
    const SidebarFilterSection = ({
        title,
        items,
        selectedItems,
        onToggle
    }: {
        title: string;
        items: string[];
        selectedItems: string[];
        onToggle: (item: string) => void;
    }) => (
        <div className="mb-6 last:mb-0">
            <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wide mb-3 border-l-2 border-brand-primary pl-2">
                {title}
            </h3>
            <div className="flex flex-wrap gap-2">
                {items.map(item => {
                    const isSelected = selectedItems.includes(item);
                    return (
                        <button
                            key={item}
                            onClick={() => onToggle(item)}
                            className={`px-3 py-1.5 rounded text-[12px] font-medium transition-all ${isSelected
                                ? 'bg-brand-primary text-white shadow-sm shadow-orange-500/20'
                                : 'bg-zinc-100 text-zinc-600 hover:text-brand-primary hover:bg-zinc-200'
                                }`}
                        >
                            {item}
                        </button>
                    );
                })}
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#f8f9fa] pb-24">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">

                {/* --- 0. Mobile Header & Drawer Controller --- */}
                <div className="lg:hidden mb-6">
                    <div className="bg-white rounded-xl p-4 shadow-sm border border-zinc-200 flex items-center justify-between">
                        <h1 className="font-bold text-zinc-800 flex items-center gap-2">
                            <span className="bg-brand-primary/10 text-brand-primary p-1.5 rounded-lg"><Filter className="h-4 w-4" /></span>
                            Bộ Lọc
                        </h1>
                        <div className="flex items-center gap-3">
                            {Object.values(filters).flat().length > 0 && (
                                <button onClick={resetFilters} className="text-xs font-medium text-zinc-400 hover:text-red-500">Đặt lại</button>
                            )}
                            <button
                                onClick={() => setIsMobileFilterOpen(true)}
                                className="bg-zinc-900 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-sm active:scale-95 transition-all flex items-center gap-2"
                            >
                                <Filter className="h-3.5 w-3.5" /> Mở Bộ Lọc
                            </button>
                        </div>
                    </div>
                </div>

                {/* --- Mobile Drawer (Overlay) --- */}
                {isMobileFilterOpen && (
                    <div className="fixed inset-0 z-[100] lg:hidden">
                        {/* Backdrop */}
                        <div
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
                            onClick={() => setIsMobileFilterOpen(false)}
                        />

                        {/* Drawer Panel */}
                        <div className="absolute right-0 top-0 h-full w-[85%] max-w-[320px] bg-white shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col">
                            {/* Drawer Header */}
                            <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50">
                                <h2 className="font-bold text-lg text-zinc-900">Bộ Lọc</h2>
                                <button
                                    onClick={() => setIsMobileFilterOpen(false)}
                                    className="p-2 rounded-full hover:bg-zinc-200 text-zinc-500 transition-colors"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            {/* Drawer Content (Scrollable) */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                {/* Sort - Mobile */}
                                <details className="group border border-zinc-100 rounded-xl overflow-hidden bg-white" open>
                                    <summary className="flex items-center justify-between p-4 font-bold text-sm text-zinc-800 list-none cursor-pointer marker:hidden bg-zinc-50/50 hover:bg-zinc-50 transition-colors">
                                        <span>Xếp hạng</span>
                                        <ChevronDown className="h-4 w-4 text-zinc-400 transition-transform group-open:rotate-180" />
                                    </summary>
                                    <div className="p-4 grid grid-cols-2 gap-2 border-t border-zinc-100">
                                        {['Mới Cập Nhật', 'Đề Cử', 'Lượt Xem', 'Đánh Giá'].map((sort) => (
                                            <button
                                                key={sort}
                                                onClick={() => { setPage(1); setSortBy(sort); }}
                                                className={`px-3 py-2 rounded-lg text-xs font-medium border text-center ${sortBy === sort ? 'border-brand-primary bg-brand-primary/5 text-brand-primary font-bold' : 'border-zinc-100 bg-zinc-50 text-zinc-600'}`}
                                            >
                                                {sort}
                                            </button>
                                        ))}
                                    </div>
                                </details>

                                {/* Genres - Mobile */}
                                <details className="group border border-zinc-100 rounded-xl overflow-hidden bg-white">
                                    <summary className="flex items-center justify-between p-4 font-bold text-sm text-zinc-800 list-none cursor-pointer marker:hidden bg-zinc-50/50 hover:bg-zinc-50 transition-colors">
                                        <span>Thể Loại</span>
                                        <ChevronDown className="h-4 w-4 text-zinc-400 transition-transform group-open:rotate-180" />
                                    </summary>
                                    <div className="p-4 flex flex-wrap gap-2 border-t border-zinc-100">
                                        {theLoaiList.map(item => (
                                            <button
                                                key={item}
                                                onClick={() => toggleFilter('theLoai', item)}
                                                className={`px-3 py-1.5 rounded text-xs font-medium border ${filters.theLoai.includes(item) ? 'border-brand-primary bg-brand-primary text-white shadow-sm' : 'border-zinc-100 bg-zinc-50 text-zinc-600'}`}
                                            >
                                                {item}
                                            </button>
                                        ))}
                                    </div>
                                </details>

                                {/* Status - Mobile */}
                                <details className="group border border-zinc-100 rounded-xl overflow-hidden bg-white">
                                    <summary className="flex items-center justify-between p-4 font-bold text-sm text-zinc-800 list-none cursor-pointer marker:hidden bg-zinc-50/50 hover:bg-zinc-50 transition-colors">
                                        <span>Tình Trạng</span>
                                        <ChevronDown className="h-4 w-4 text-zinc-400 transition-transform group-open:rotate-180" />
                                    </summary>
                                    <div className="p-4 flex flex-wrap gap-2 border-t border-zinc-100">
                                        {TINH_TRANG.map(item => (
                                            <button
                                                key={item}
                                                onClick={() => toggleFilter('tinhTrang', item)}
                                                className={`px-3 py-1.5 rounded text-xs font-medium border ${filters.tinhTrang.includes(item) ? 'border-brand-primary bg-brand-primary text-white shadow-sm' : 'border-zinc-100 bg-zinc-50 text-zinc-600'}`}
                                            >
                                                {item}
                                            </button>
                                        ))}
                                    </div>
                                </details>

                                {/* Chapters - Mobile */}
                                <details className="group border border-zinc-100 rounded-xl overflow-hidden bg-white">
                                    <summary className="flex items-center justify-between p-4 font-bold text-sm text-zinc-800 list-none cursor-pointer marker:hidden bg-zinc-50/50 hover:bg-zinc-50 transition-colors">
                                        <span>Số Chương</span>
                                        <ChevronDown className="h-4 w-4 text-zinc-400 transition-transform group-open:rotate-180" />
                                    </summary>
                                    <div className="p-4 flex flex-wrap gap-2 border-t border-zinc-100">
                                        {SO_CHUONG.map(item => (
                                            <button
                                                key={item}
                                                onClick={() => toggleFilter('soChuong', item)}
                                                className={`px-3 py-1.5 rounded text-xs font-medium border ${filters.soChuong.includes(item) ? 'border-brand-primary bg-brand-primary text-white shadow-sm' : 'border-zinc-100 bg-zinc-50 text-zinc-600'}`}
                                            >
                                                {item}
                                            </button>
                                        ))}
                                    </div>
                                </details>

                                {/* Bối Cảnh - Mobile */}
                                <details className="group border border-zinc-100 rounded-xl overflow-hidden bg-white">
                                    <summary className="flex items-center justify-between p-4 font-bold text-sm text-zinc-800 list-none cursor-pointer marker:hidden bg-zinc-50/50 hover:bg-zinc-50 transition-colors">
                                        <span>Bối Cảnh</span>
                                        <ChevronDown className="h-4 w-4 text-zinc-400 transition-transform group-open:rotate-180" />
                                    </summary>
                                    <div className="p-4 flex flex-wrap gap-2 border-t border-zinc-100">
                                        {boiCanhList.map(item => (
                                            <button
                                                key={item}
                                                onClick={() => toggleFilter('boiCanh', item)}
                                                className={`px-3 py-1.5 rounded text-xs font-medium border ${filters.boiCanh.includes(item) ? 'border-brand-primary bg-brand-primary text-white shadow-sm' : 'border-zinc-100 bg-zinc-50 text-zinc-600'}`}
                                            >
                                                {item}
                                            </button>
                                        ))}
                                    </div>
                                </details>

                                {/* Lưu Phái - Mobile */}
                                <details className="group border border-zinc-100 rounded-xl overflow-hidden bg-white">
                                    <summary className="flex items-center justify-between p-4 font-bold text-sm text-zinc-800 list-none cursor-pointer marker:hidden bg-zinc-50/50 hover:bg-zinc-50 transition-colors">
                                        <span>Lưu Phái</span>
                                        <ChevronDown className="h-4 w-4 text-zinc-400 transition-transform group-open:rotate-180" />
                                    </summary>
                                    <div className="p-4 flex flex-wrap gap-2 border-t border-zinc-100">
                                        {luuPhaiList.map(item => (
                                            <button
                                                key={item}
                                                onClick={() => toggleFilter('luuPhai', item)}
                                                className={`px-3 py-1.5 rounded text-xs font-medium border ${filters.luuPhai.includes(item) ? 'border-brand-primary bg-brand-primary text-white shadow-sm' : 'border-zinc-100 bg-zinc-50 text-zinc-600'}`}
                                            >
                                                {item}
                                            </button>
                                        ))}
                                    </div>
                                </details>

                                {/* Tính Cách - Mobile */}
                                <details className="group border border-zinc-100 rounded-xl overflow-hidden bg-white">
                                    <summary className="flex items-center justify-between p-4 font-bold text-sm text-zinc-800 list-none cursor-pointer marker:hidden bg-zinc-50/50 hover:bg-zinc-50 transition-colors">
                                        <span>Tính Cách</span>
                                        <ChevronDown className="h-4 w-4 text-zinc-400 transition-transform group-open:rotate-180" />
                                    </summary>
                                    <div className="p-4 flex flex-wrap gap-2 border-t border-zinc-100">
                                        {tinhCachList.map(item => (
                                            <button
                                                key={item}
                                                onClick={() => toggleFilter('tinhCach', item)}
                                                className={`px-3 py-1.5 rounded text-xs font-medium border ${filters.tinhCach.includes(item) ? 'border-brand-primary bg-brand-primary text-white shadow-sm' : 'border-zinc-100 bg-zinc-50 text-zinc-600'}`}
                                            >
                                                {item}
                                            </button>
                                        ))}
                                    </div>
                                </details>

                                {/* Thị Giác - Mobile */}
                                <details className="group border border-zinc-100 rounded-xl overflow-hidden bg-white">
                                    <summary className="flex items-center justify-between p-4 font-bold text-sm text-zinc-800 list-none cursor-pointer marker:hidden bg-zinc-50/50 hover:bg-zinc-50 transition-colors">
                                        <span>Thị Giác</span>
                                        <ChevronDown className="h-4 w-4 text-zinc-400 transition-transform group-open:rotate-180" />
                                    </summary>
                                    <div className="p-4 flex flex-wrap gap-2 border-t border-zinc-100">
                                        {thiGiacList.map(item => (
                                            <button
                                                key={item}
                                                onClick={() => toggleFilter('thiGiac', item)}
                                                className={`px-3 py-1.5 rounded text-xs font-medium border ${filters.thiGiac.includes(item) ? 'border-brand-primary bg-brand-primary text-white shadow-sm' : 'border-zinc-100 bg-zinc-50 text-zinc-600'}`}
                                            >
                                                {item}
                                            </button>
                                        ))}
                                    </div>
                                </details>
                            </div>

                            {/* Drawer Footer */}
                            <div className="p-4 border-t border-zinc-100 bg-white">
                                <button
                                    onClick={() => setIsMobileFilterOpen(false)}
                                    className="w-full py-3 bg-brand-primary text-white rounded-xl font-bold shadow-lg shadow-orange-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                    <Check className="h-4 w-4" />
                                    Xem {pagination.total} Kết Quả
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- 1. Top Filter Panel (Desktop Only) --- */}
                <div className="hidden lg:block bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden mb-8">
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
                        <h1 className="flex items-center gap-2 text-lg font-bold text-zinc-800">
                            <Filter className="h-5 w-5 text-brand-primary" />
                            Bộ Lọc Tìm Kiếm
                        </h1>
                        <button
                            onClick={resetFilters}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-zinc-500 hover:bg-zinc-100 hover:text-brand-primary transition-colors"
                        >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Đặt lại
                        </button>
                    </div>

                    {/* Genre List (Horizontal) — mỗi type một dòng */}
                    <div className="p-6">
                        {theLoaiList.length > 0 && (
                            <FilterSection
                                title="Thể Loại"
                                items={theLoaiList}
                                selectedItems={filters.theLoai}
                                onToggle={(item) => toggleFilter('theLoai', item)}
                            />
                        )}
                        {boiCanhList.length > 0 && (
                            <FilterSection
                                title="Bối Cảnh"
                                items={boiCanhList}
                                selectedItems={filters.boiCanh}
                                onToggle={(item) => toggleFilter('boiCanh', item)}
                            />
                        )}
                        {luuPhaiList.length > 0 && (
                            <FilterSection
                                title="Lưu Phái"
                                items={luuPhaiList}
                                selectedItems={filters.luuPhai}
                                onToggle={(item) => toggleFilter('luuPhai', item)}
                            />
                        )}
                        {tinhCachList.length > 0 && (
                            <FilterSection
                                title="Tính Cách"
                                items={tinhCachList}
                                selectedItems={filters.tinhCach}
                                onToggle={(item) => toggleFilter('tinhCach', item)}
                            />
                        )}
                        {thiGiacList.length > 0 && (
                            <FilterSection
                                title="Thị Giác"
                                items={thiGiacList}
                                selectedItems={filters.thiGiac}
                                onToggle={(item) => toggleFilter('thiGiac', item)}
                            />
                        )}
                        {/* Active Filters Summary (Moved here or keep below? Keep simplified version above results or here) */}
                        <div className="mt-4 pt-4 border-t border-dashed border-zinc-100 flex flex-wrap gap-2 items-center">
                            <span className="text-xs font-bold text-zinc-400 uppercase mr-2">Đang chọn:</span>
                            {Object.values(filters).flat().length === 0 && timeFilter.type === 'all' && (
                                <span className="text-xs text-zinc-400 italic">Chưa chọn bộ lọc nào</span>
                            )}
                            {Object.entries(filters).map(([key, items]) =>
                                items.map(item => (
                                    <span key={item} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-zinc-50 border border-zinc-200 text-xs font-medium text-zinc-700">
                                        {item}
                                        <button onClick={() => toggleFilter(key as any, item)} className="hover:text-red-500 transition-colors ml-1">
                                            &times;
                                        </button>
                                    </span>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* --- 2. Main Content (Left Column) --- */}
                    <div className="lg:col-span-3 order-2 lg:order-1">
                        {/* Search Input */}
                        <div className="relative mb-5">
                            <input
                                type="text"
                                value={localKeyword}
                                onChange={(e) => handleLocalSearch(e.target.value)}
                                placeholder="Tìm kiếm tên truyện, tác giả..."
                                className="w-full rounded-xl py-3 pl-5 pr-12 text-sm outline-none transition-all border border-zinc-200 bg-white shadow-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                                style={{ color: '#18181b' }}
                            />
                            <Search className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
                        </div>

                        {/* Results Header */}
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-zinc-800">
                                {keyword
                                    ? <>Kết quả cho <span className="text-orange-500">"{keyword}"</span> <span className="text-zinc-400 font-normal text-base ml-1">({pagination.total} truyện)</span></>
                                    : <>Kết quả <span className="text-zinc-400 font-normal text-base ml-2">({pagination.total} truyện)</span></>
                                }
                            </h2>
                        </div>

                        {/* Grid Results */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                            {loading && stories.length === 0 && Array.from({ length: 6 }).map((_, i) => (
                                <div key={i} className="bg-white rounded-xl border border-zinc-200 overflow-hidden animate-pulse">
                                    <div className="p-4 flex gap-4">
                                        <div className="w-24 h-32 bg-zinc-200 rounded shrink-0" />
                                        <div className="flex-1 space-y-2 pt-1">
                                            <div className="h-4 bg-zinc-200 rounded w-3/4" />
                                            <div className="h-4 bg-zinc-200 rounded w-1/2" />
                                            <div className="h-3 bg-zinc-100 rounded w-1/3 mt-2" />
                                        </div>
                                    </div>
                                    <div className="px-4 py-3 bg-zinc-50 border-t border-zinc-100 flex gap-4">
                                        <div className="h-3 bg-zinc-200 rounded w-1/3" />
                                        <div className="h-3 bg-zinc-200 rounded w-1/3" />
                                    </div>
                                </div>
                            ))}
                            {!loading && stories.length === 0 && (
                                <div className="col-span-full py-16 text-center text-zinc-400">
                                    <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
                                    <p className="text-sm">Không tìm thấy truyện phù hợp</p>
                                </div>
                            )}
                            {stories.map((story, idx) => (
                                <a href={`/truyen/${story.slug}`} key={story.id || idx} className="group bg-white rounded-xl border border-zinc-200 overflow-hidden hover:shadow-lg transition-all duration-300 flex flex-col h-full">
                                    <div className="p-4 flex gap-4">
                                        <div className="w-24 h-32 bg-zinc-100 rounded shadow-inner shrink-0 flex items-center justify-center overflow-hidden group-hover:scale-105 transition-transform duration-300 relative">
                                            {story.coverImage ? (
                                                <img
                                                    src={story.coverImage}
                                                    alt={story.title}
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => {
                                                        e.currentTarget.style.display = 'none';
                                                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                                    }}
                                                />
                                            ) : null}
                                            {/* Fallback Icon (Hidden if image loads successfully) */}
                                            <div className={`${story.coverImage ? 'hidden' : ''} absolute inset-0 flex items-center justify-center bg-zinc-100`}>
                                                <BookOpen className="h-8 w-8 text-zinc-300" />
                                            </div>

                                            {/* Full Badge Overlay */}
                                            {story.status === 'COMPLETED' && (
                                                <span className="absolute top-0 right-0 bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 shadow-sm z-10 uppercase tracking-wider">
                                                    Full
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                                            <h3 className="font-bold text-base sm:text-lg text-zinc-900 group-hover:text-brand-primary transition-colors line-clamp-2 leading-tight">
                                                {story.title}
                                            </h3>

                                            <div className="flex flex-wrap gap-2 mt-1">
                                                {story.genres && story.genres.slice(0, 2).map((g: any) => (
                                                    <span key={g.name} className="px-2 py-0.5 rounded border border-zinc-200 bg-zinc-50 text-[11px] text-zinc-600 font-medium">
                                                        {g.name}
                                                    </span>
                                                ))}
                                                {story.status === 'COMPLETED' ? (
                                                    <span className="px-2 py-0.5 rounded border border-blue-200 bg-blue-50 text-[11px] text-blue-600 font-medium">Full</span>
                                                ) : story.status === 'TRANSLATED' ? (
                                                    <span className="px-2 py-0.5 rounded border border-orange-200 bg-orange-50 text-[11px] text-orange-600 font-medium">Dịch</span>
                                                ) : story.status === 'CONVERTED' ? (
                                                    <span className="px-2 py-0.5 rounded border border-purple-200 bg-purple-50 text-[11px] text-purple-600 font-medium">Convert</span>
                                                ) : (
                                                    <span className="px-2 py-0.5 rounded border border-green-200 bg-green-50 text-[11px] text-green-600 font-medium">Đang ra</span>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-1.5 text-xs text-zinc-500 mt-1">
                                                <BookOpen className="h-3.5 w-3.5 text-zinc-400" />
                                                <span>Chương: <span className="font-semibold text-zinc-700">{formatNumber(story.chapterCount || story.totalChapters || 0)}</span></span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-auto px-4 py-3 bg-zinc-50 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-500">
                                        <div className="flex items-center gap-1.5" title="Đánh giá">
                                            <Star className="h-3.5 w-3.5 text-yellow-500 fill-current" />
                                            <span className="font-medium text-zinc-600">Đánh giá:</span>
                                            <span className="font-bold text-zinc-800">{story.ratingScore?.toFixed(1) || '0.0'}</span>
                                            <span className="text-zinc-400">({formatNumber(story.ratingCount || 0)})</span>
                                        </div>

                                        <div className="flex items-center gap-1.5" title="Lượt xem">
                                            <Eye className="h-3.5 w-3.5 text-zinc-400" />
                                            <span className="font-medium text-zinc-600">Xem:</span>
                                            <span className="font-bold text-zinc-800">{formatNumber(story.viewCount || 0)}</span>
                                        </div>
                                    </div>
                                </a>
                            ))}
                        </div>
                        {/* Pagination */}
                        {pagination.totalPages > 1 && (
                            <div className="mt-10 flex justify-center gap-2 flex-wrap">
                                {page > 1 && (
                                    <button onClick={() => setPage(p => p - 1)} className="px-3 py-2 rounded-lg border border-zinc-200 text-sm font-medium text-zinc-600 hover:bg-zinc-100 transition-colors">← Trước</button>
                                )}
                                {Array.from({ length: Math.min(pagination.totalPages, 7) }, (_, i) => {
                                    let p: number;
                                    if (pagination.totalPages <= 7) p = i + 1;
                                    else if (page <= 4) p = i + 1;
                                    else if (page >= pagination.totalPages - 3) p = pagination.totalPages - 6 + i;
                                    else p = page - 3 + i;
                                    return (
                                        <button key={p} onClick={() => setPage(p)}
                                            className={`h-9 w-9 flex items-center justify-center rounded-lg font-bold transition-colors text-sm ${p === page ? 'bg-brand-primary text-white shadow-sm' : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50'}`}>
                                            {p}
                                        </button>
                                    );
                                })}
                                {page < pagination.totalPages && (
                                    <button onClick={() => setPage(p => p + 1)} className="px-3 py-2 rounded-lg border border-zinc-200 text-sm font-medium text-zinc-600 hover:bg-zinc-100 transition-colors">Tiếp →</button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* --- 3. Sidebar (Right Column) --- */}
                    <div className="hidden lg:block lg:col-span-1 order-1 lg:order-2 space-y-8">

                        {/* Sort Section */}
                        <div className="bg-white p-5 rounded-xl shadow-sm border border-zinc-200">
                            <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wide mb-3 border-l-2 border-brand-primary pl-2">
                                Xếp hạng
                            </h3>
                            <div className="flex flex-col gap-2">
                                {['Mới Cập Nhật', 'Đề Cử', 'Lượt Xem', 'Đánh Giá'].map((sort) => (
                                    <button
                                        key={sort}
                                        onClick={() => { setPage(1); setSortBy(sort); }}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-between ${sortBy === sort
                                            ? 'bg-brand-primary/10 text-brand-primary font-bold'
                                            : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
                                            }`}
                                    >
                                        {sort}
                                        {sortBy === sort && <Check className="h-4 w-4" />}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Other Filters */}
                        <div className="bg-white p-5 rounded-xl shadow-sm border border-zinc-200">
                            <SidebarFilterSection
                                title="Tình Trạng"
                                items={TINH_TRANG}
                                selectedItems={filters.tinhTrang}
                                onToggle={(item) => toggleFilter('tinhTrang', item)}
                            />
                            <div className="h-px bg-zinc-100 my-4" />
                            <SidebarFilterSection
                                title="Số Chương"
                                items={SO_CHUONG}
                                selectedItems={filters.soChuong}
                                onToggle={(item) => toggleFilter('soChuong', item)}
                            />
                            <div className="h-px bg-zinc-100 my-4" />
                            {/* Time Filter - adapted for sidebar */}
                            <div className="mb-6 last:mb-0">
                                <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wide mb-3 border-l-2 border-brand-primary pl-2">Thời Gian</h3>
                                <div className="space-y-3">
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <input
                                            type="radio"
                                            name="timeFilterSidebar"
                                            checked={timeFilter.type === 'all'}
                                            onChange={() => setTimeFilter(prev => ({ ...prev, type: 'all' }))}
                                            className="accent-brand-primary w-4 h-4"
                                        />
                                        <span className={`text-sm ${timeFilter.type === 'all' ? 'text-zinc-900 font-medium' : 'text-zinc-600'}`}>Mọi thời gian</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <input
                                            type="radio"
                                            name="timeFilterSidebar"
                                            checked={timeFilter.type === 'specific'}
                                            onChange={() => setTimeFilter(prev => ({ ...prev, type: 'specific' }))}
                                            className="accent-brand-primary w-4 h-4"
                                        />
                                        <span className={`text-sm ${timeFilter.type === 'specific' ? 'text-zinc-900 font-medium' : 'text-zinc-600'}`}>Tìm trong tháng</span>
                                    </label>

                                    {timeFilter.type === 'specific' && (
                                        <div className="flex gap-2 pl-6 animate-in slide-in-from-top-2">
                                            <select
                                                value={timeFilter.month}
                                                onChange={(e) => setTimeFilter(prev => ({ ...prev, type: 'specific', month: parseInt(e.target.value) }))}
                                                className="bg-zinc-50 border border-zinc-200 text-zinc-700 text-xs rounded p-1.5 outline-none focus:border-brand-primary"
                                            >
                                                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                                    <option key={m} value={m}>Tháng {m}</option>
                                                ))}
                                            </select>
                                            <select
                                                value={timeFilter.year}
                                                onChange={(e) => setTimeFilter(prev => ({ ...prev, type: 'specific', year: parseInt(e.target.value) }))}
                                                className="bg-zinc-50 border border-zinc-200 text-zinc-700 text-xs rounded p-1.5 outline-none focus:border-brand-primary"
                                            >
                                                {Array.from({ length: 5 }, (_, i) => 2024 + i).map(y => (
                                                    <option key={y} value={y}>{y}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="h-px bg-zinc-100 my-4" />
                            <SidebarFilterSection
                                title="Bối Cảnh"
                                items={boiCanhList}
                                selectedItems={filters.boiCanh}
                                onToggle={(item) => toggleFilter('boiCanh', item)}
                            />
                            <div className="h-px bg-zinc-100 my-4" />
                            <SidebarFilterSection
                                title="Lưu Phái"
                                items={luuPhaiList}
                                selectedItems={filters.luuPhai}
                                onToggle={(item) => toggleFilter('luuPhai', item)}
                            />
                            <div className="h-px bg-zinc-100 my-4" />
                            <SidebarFilterSection
                                title="Tính Cách"
                                items={tinhCachList}
                                selectedItems={filters.tinhCach}
                                onToggle={(item) => toggleFilter('tinhCach', item)}
                            />
                            <div className="h-px bg-zinc-100 my-4" />
                            <SidebarFilterSection
                                title="Thị Giác"
                                items={thiGiacList}
                                selectedItems={filters.thiGiac}
                                onToggle={(item) => toggleFilter('thiGiac', item)}
                            />
                        </div>

                    </div>
                </div>

            </div>
        </div>
    );
};
export default function Page() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-[#f8f9fa] pb-24 flex items-center justify-center">
                <div className="w-8 h-8 rounded-full border-4 border-zinc-200 border-t-brand-primary animate-spin"></div>
            </div>
        }>
            <FilterPage />
        </Suspense>
    );
}
