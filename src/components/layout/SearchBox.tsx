"use client";

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Search, BookOpen } from 'lucide-react';

interface SearchBoxProps {
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    showResults: boolean;
    setShowResults: (show: boolean) => void;
    results: any[];
    handleSearch: () => void;
    className?: string;
    isLoading?: boolean;
}

const SearchBox: React.FC<SearchBoxProps> = ({
    searchQuery,
    setSearchQuery,
    showResults,
    setShowResults,
    results,
    handleSearch,
    className = "",
    isLoading = false,
}) => {
    return (
        <div className={className} role="search">
            <div className="relative z-10">
                <input
                    type="search"
                    placeholder="Tìm kiếm truyện..."
                    value={searchQuery}
                    aria-label="Tìm kiếm truyện"
                    aria-autocomplete="list"
                    aria-controls={showResults ? "search-results" : undefined}
                    onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setShowResults(e.target.value.length > 0);
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    onFocus={() => searchQuery.length > 0 && setShowResults(true)}
                    onBlur={() => setTimeout(() => setShowResults(false), 200)}
                    className="w-full rounded-full py-2 pl-4 pr-10 text-sm outline-none transition-all"
                    style={{
                        background: 'var(--search-bg)',
                        border: '1px solid var(--search-border)',
                        color: 'var(--text)',
                    }}
                    onFocusCapture={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                    onBlurCapture={e => (e.currentTarget.style.borderColor = 'var(--search-border)')}
                />
                {/* placeholder color via injected style — tailwind can't do CSS vars */}
                <style>{`
                  input[type="search"]::placeholder { color: var(--text-muted); }
                  input[type="search"]::-webkit-search-cancel-button { display: none; }
                `}</style>
                <button
                    onClick={handleSearch}
                    aria-label="Tìm kiếm"
                    className="absolute right-1 top-1 rounded-full p-1.5 text-white shadow-sm transition-colors"
                    style={{ background: 'var(--accent)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'var(--accent)')}
                >
                    <Search className="h-4 w-4" aria-hidden="true" />
                </button>
            </div>

            {/* Instant Search Results Dropdown */}
            {showResults && searchQuery.length > 0 && (
                <div
                    id="search-results"
                    role="listbox"
                    aria-label="Kết quả tìm kiếm"
                    className="absolute top-full left-0 right-0 mt-2 rounded-2xl shadow-2xl overflow-hidden z-50"
                    style={{
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                    }}
                >
                    <div
                        className="p-2 flex items-center justify-between"
                        style={{ borderBottom: '1px solid var(--border-soft)' }}
                    >
                        <span
                            className="text-[10px] font-bold uppercase tracking-wider pl-2"
                            style={{ color: 'var(--text-muted)' }}
                        >
                            Kết quả tìm kiếm
                        </span>
                        <Link
                            href={`/tim-kiem?tu-khoa=${encodeURIComponent(searchQuery.trim())}`}
                            onClick={() => setShowResults(false)}
                            className="text-[10px] font-bold pr-2 transition-colors"
                            style={{ color: 'var(--accent)' }}
                            aria-label={`Xem tất cả kết quả cho "${searchQuery}"`}
                        >
                            Xem tất cả
                        </Link>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto">
                        {isLoading ? (
                            <div className="flex items-center justify-center gap-2 p-5" style={{ color: 'var(--text-muted)' }}>
                                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                                </svg>
                                <span className="text-sm">Đang tìm...</span>
                            </div>
                        ) : results.length > 0 ? (
                            results.map((result, idx) => (
                                <Link
                                    key={result.id || idx}
                                    href={`/truyen/${result.slug}`}
                                    role="option"
                                    aria-label={`${result.title} - ${result.author}`}
                                    className="flex items-center gap-3 p-3 transition-colors"
                                    style={{ borderBottom: '1px solid var(--border-soft)' }}
                                    onClick={() => setShowResults(false)}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--card)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                >
                                    <div
                                        className="w-10 h-14 rounded shrink-0 flex items-center justify-center overflow-hidden relative"
                                        style={{ background: 'var(--card2)', border: '1px solid var(--border)' }}
                                    >
                                        {result.coverImage ? (
                                            <Image
                                                src={result.coverImage}
                                                alt={`Ảnh bìa ${result.title}`}
                                                fill
                                                sizes="40px"
                                                className="object-cover"
                                                unoptimized={result.coverImage.startsWith('/covers/')}
                                            />
                                        ) : (
                                            <BookOpen className="h-5 w-5" style={{ color: 'var(--text-soft)' }} aria-hidden="true" />
                                        )}
                                        {result.status === 'COMPLETED' && (
                                            <span className="absolute top-0 right-0 bg-red-600 text-white text-[7px] font-bold px-1 py-0.5 z-10 uppercase tracking-tighter leading-none">
                                                Full
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-sm font-bold truncate" style={{ color: 'var(--text)' }}>{result.title}</h4>
                                    </div>
                                </Link>
                            ))
                        ) : (
                            <div
                                className="p-4 text-center text-sm italic"
                                style={{ color: 'var(--text-muted)' }}
                                role="status"
                            >
                                Không tìm thấy kết quả nào...
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SearchBox;
