"use client";

import React from 'react';
import Link from 'next/link';
import { Search, BookOpen, Star } from 'lucide-react';

interface SearchBoxProps {
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    showResults: boolean;
    setShowResults: (show: boolean) => void;
    results: any[];
    handleSearch: () => void;
    className?: string;
}

const SearchBox: React.FC<SearchBoxProps> = ({
    searchQuery,
    setSearchQuery,
    showResults,
    setShowResults,
    results,
    handleSearch,
    className = ""
}) => {
    return (
        <div className={className}>
            <div className="relative z-10">
                <input
                    type="text"
                    placeholder="Tìm kiếm truyện..."
                    value={searchQuery}
                    onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setShowResults(e.target.value.length > 0);
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    onFocus={() => searchQuery.length > 0 && setShowResults(true)}
                    onBlur={() => setTimeout(() => setShowResults(false), 200)}
                    className="w-full rounded-full border border-zinc-200 bg-zinc-50 py-2 pl-4 pr-10 text-sm text-zinc-800 outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20 transition-all"
                />
                <button
                    onClick={handleSearch}
                    className="absolute right-1 top-1 rounded-full bg-brand-primary p-1.5 text-white shadow-sm hover:bg-orange-600 transition-colors"
                >
                    <Search className="h-4 w-4" />
                </button>
            </div>

            {/* Instant Search Results Dropdown */}
            {showResults && searchQuery.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl border border-zinc-100 shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-50">
                    <div className="p-2 border-b border-zinc-50 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider pl-2">Kết quả tìm kiếm</span>
                        <Link
                            href={`/tim-kiem?tu-khoa=${encodeURIComponent(searchQuery.trim())}`}
                            onClick={() => setShowResults(false)}
                            className="text-[10px] font-bold text-brand-primary hover:underline pr-2"
                        >
                            Xem tất cả
                        </Link>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto">
                        {results.length > 0 ? (
                            results.map((result, idx) => (
                                <Link
                                    key={result.id || idx}
                                    href={`/truyen/${result.slug}`}
                                    className="flex items-center gap-3 p-3 hover:bg-zinc-50 transition-colors border-b border-zinc-50 last:border-0"
                                    onClick={() => setShowResults(false)}
                                >
                                    <div className="w-10 h-14 bg-zinc-100 rounded shrink-0 flex items-center justify-center overflow-hidden border border-zinc-100 relative">
                                        {result.coverImage ? (
                                            <img src={result.coverImage} className="w-full h-full object-cover" alt="" />
                                        ) : (
                                            <BookOpen className="h-5 w-5 text-zinc-300" />
                                        )}
                                        {/* Status Badge */}
                                        {result.status === 'COMPLETED' && (
                                            <span className="absolute top-0 right-0 bg-red-600 text-white text-[7px] font-bold px-1 py-0.5 shadow-sm z-10 uppercase tracking-tighter leading-none">
                                                Full
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-sm font-bold text-zinc-800 truncate">{result.title}</h4>
                                        <p className="text-[11px] text-zinc-500 mt-0.5">{result.author}</p>
                                        <div className="flex items-center gap-1 mt-1 text-orange-400">
                                            <Star className="h-3 w-3 fill-current" />
                                            <span className="text-[10px] font-bold text-zinc-700">{result.ratingScore || 5.0}</span>
                                        </div>
                                    </div>
                                </Link>
                            ))) : (
                            <div className="p-4 text-center text-sm text-zinc-400 italic">
                                {results.length === 0 ? "Không tìm thấy..." : "Đang tìm..."}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SearchBox;
