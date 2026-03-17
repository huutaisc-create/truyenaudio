"use client";

import React, { useState, useEffect } from 'react';
import { BookOpen } from 'lucide-react';
import { useReadingHistory } from '@/hooks/useReadingHistory';
import Link from 'next/link';

export default function ReadingHistoryWidget() {
    const { history } = useReadingHistory();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Chưa mount thì không render gì — tránh hydration mismatch
    if (!mounted || history.length === 0) return null;

    return (
        <div className="bg-white rounded-xl border border-zinc-100 shadow-sm overflow-hidden animate-in fade-in duration-500">
            <div className="px-4 py-3 border-b border-orange-100">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border-[2.5px] border-[#e8580a] text-[#e8580a]">
                    <span className="w-[22px] h-[22px] bg-white rounded-full flex items-center justify-center text-[11px] shrink-0">🕐</span>
                    <span className="text-[12px] font-black uppercase tracking-[.1em]">Truyện Đọc Gần Đây</span>
                </div>
            </div>
            <div className="divide-y divide-zinc-50">
                {history.slice(0, 5).map((item) => (
                    <Link
                        key={item.slug}
                        href={`/truyen/${item.slug}/chuong-${item.chapterIndex || 1}`}
                        className="group flex items-center gap-3 px-3 py-2.5 hover:bg-orange-50 transition-colors"
                    >
                        <div className="shrink-0 w-9 h-12 rounded overflow-hidden bg-zinc-200">
                            {item.coverImage
                                ? <img src={item.coverImage} alt={item.title} className="w-full h-full object-cover" />
                                : <div className="w-full h-full flex items-center justify-center text-zinc-300"><BookOpen size={13} /></div>
                            }
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="truncate text-sm font-semibold text-zinc-800 group-hover:text-brand-primary transition-colors">{item.title}</h4>
                        </div>
                        <div className="shrink-0 text-right">
                            <span className="block text-xs font-bold text-brand-primary">C.{item.chapterIndex || 1}</span>
                            <span className="block text-xs text-zinc-400">Đọc tiếp</span>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}
