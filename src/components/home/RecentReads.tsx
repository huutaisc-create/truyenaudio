"use client";

import Link from "next/link";
import Image from "next/image";
import { Clock, BookOpen } from "lucide-react";
import { useReadingHistory } from "@/hooks/useReadingHistory";

export default function RecentReads() {
  const { history } = useReadingHistory();

  if (!history || history.length === 0) return null;

  return (
    <section className="mb-4 lg:hidden" aria-label="Truyện đọc gần đây">
      <div
        className="p-3 rounded-xl mx-0"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div
          className="flex items-center justify-between mb-3 pb-2"
          style={{ borderBottom: "1px solid var(--border-soft)" }}
        >
          <h2
            className="text-sm font-black uppercase italic pl-2"
            style={{
              borderLeft: "4px solid var(--accent)",
              color: "var(--text)",
            }}
          >
            Truyện đọc gần đây
          </h2>
          <Clock className="h-4 w-4" style={{ color: "var(--text-soft)" }} aria-hidden="true" />
        </div>

        <div className="flex gap-3 overflow-x-auto pb-2 snap-x px-1 -mx-1"
          style={{ scrollbarWidth: "none" }}
        >
          <style>{`div::-webkit-scrollbar{display:none}`}</style>
          {history.slice(0, 3).map((item) => (
            <Link
              key={item.slug}
              href={`/truyen/${item.slug}/chuong-${item.chapterIndex || 1}`}
              aria-label={`Đọc tiếp ${item.title}, chương ${item.chapterIndex || 1}`}
              className="flex-none w-[80%] snap-center flex items-center gap-2.5 p-2 rounded-lg transition-colors"
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
              }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.borderColor = "var(--accent)")}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.borderColor = "var(--border)")}
            >
              <div
                className="w-[35px] aspect-[2/3] rounded overflow-hidden shrink-0 relative"
                style={{ background: "var(--card2)", border: "1px solid var(--border)" }}
              >
                {item.coverImage ? (
                  <Image
                    src={item.coverImage}
                    fill
                    sizes="35px"
                    className="object-cover"
                    alt={`Ảnh bìa ${item.title}`}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center" style={{ color: "var(--text-soft)" }}>
                    <BookOpen className="h-3 w-3" aria-hidden="true" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="truncate text-xs font-bold" style={{ color: "var(--text)" }}>
                  {item.title}
                </h3>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-[10px] font-medium" style={{ color: "var(--accent)" }}>
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
