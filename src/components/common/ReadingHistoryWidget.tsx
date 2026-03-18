"use client";

import React, { useState, useEffect } from 'react';
import { BookOpen } from 'lucide-react';
import { useReadingHistory } from '@/hooks/useReadingHistory';
import Link from 'next/link';
import Image from 'next/image'; // FIX LCP

export default function ReadingHistoryWidget() {
    const { history } = useReadingHistory();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted || history.length === 0) return null;

    return (
        <section
            aria-label="Truyện đọc gần đây" // FIX A11Y
            className="bg-white rounded-xl border border-zinc-100 shadow-sm overflow-hidden animate-in fade-in duration-500"
        >
            <div className="px-4 py-3 border-b border-orange-100">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border-[2.5px] border-[#e8580a] text-[#e8580a]">
                    <span className="w-[22px] h-[22px] bg-white rounded-full flex items-center justify-center text-[11px] shrink-0" aria-hidden="true">🕐</span>
                    <span className="text-[12px] font-black uppercase tracking-[.1em]">Truyện Đọc Gần Đây</span>
                </div>
            </div>
            <div className="divide-y divide-zinc-50">
                {history.slice(0, 5).map((item) => (
                    <Link
                        key={item.slug}
                        href={`/truyen/${item.slug}/chuong-${item.chapterIndex || 1}`}
                        aria-label={`Đọc tiếp ${item.title}, chương ${item.chapterIndex || 1}`} // FIX A11Y
                        className="group flex items-center gap-3 px-3 py-2.5 hover:bg-orange-50 transition-colors"
                    >
                        {/* FIX LCP: next/image thay <img> */}
                        <div className="shrink-0 w-9 h-12 rounded overflow-hidden bg-zinc-200 relative">
                            {item.coverImage ? (
                                <Image
                                    src={item.coverImage}
                                    alt={`Ảnh bìa ${item.title}`} // FIX A11Y
                                    fill
                                    sizes="36px"
                                    className="object-cover"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-zinc-300">
                                    <BookOpen size={13} aria-hidden="true" />
                                </div>
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="truncate text-sm font-semibold text-zinc-800 group-hover:text-brand-primary transition-colors">
                                {item.title}
                            </h3>
                        </div>
                        <div className="shrink-0 text-right">
                            <span className="block text-xs font-bold text-brand-primary">C.{item.chapterIndex || 1}</span>
                            <span className="block text-xs text-zinc-400" aria-hidden="true">Đọc tiếp</span>
                        </div>
                    </Link>
                ))}
            </div>
        </section>
    );
}
