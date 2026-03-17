"use client";

import Link from "next/link";
import { Clock, BookOpen } from "lucide-react";
import { useReadingHistory } from "@/hooks/useReadingHistory";

export default function RecentReads() {
    const { history } = useReadingHistory();

    if (!history || history.length === 0) return null;

    return (
        <section className="mb-4 lg:hidden">
            <div className="bg-white p-3 rounded-xl border border-zinc-100 shadow-sm mx-0">
                <div className="flex items-center justify-between mb-3 border-b border-zinc-50 pb-2">
                    <h2 className="text-sm font-black border-l-4 border-[#E88F5E] pl-2 text-zinc-800 uppercase italic">
                        Truyện đọc gần đây
                    </h2>
                    <Clock className="h-4 w-4 text-zinc-300" />
                </div>

                <div className="flex gap-3 overflow-x-auto pb-2 snap-x px-1 -mx-1 scrollbar-hide">
                    {history.slice(0, 3).map((item) => (
                        <Link
                            key={item.slug}
                            href={`/truyen/${item.slug}/chuong-${item.chapterIndex || 1}`}
                            className="flex-none w-[80%] snap-center flex items-center gap-2.5 p-2 bg-zinc-50 rounded-lg border border-zinc-100 shadow-sm"
                        >
                            {/* Image - Compact */}
                            <div className="w-[35px] aspect-[2/3] rounded overflow-hidden bg-zinc-200 border border-zinc-300 shrink-0">
                                {item.coverImage ? (
                                    <img src={item.coverImage} className="w-full h-full object-cover" alt="" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <BookOpen className="h-3 w-3 text-zinc-300" />
                                    </div>
                                )}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <h3 className="truncate text-xs font-bold text-zinc-800">
                                    {item.title}
                                </h3>
                                <div className="flex items-center gap-1 mt-0.5">
                                    <span className="text-[10px] text-brand-primary font-medium">
                                        Đọc tiếp C.{item.chapterIndex || 1}
                                    </span>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </section>
    );
}
