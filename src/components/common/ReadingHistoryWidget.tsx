"use client";

import React, { useState, useEffect } from "react";
import { useReadingHistory } from "@/hooks/useReadingHistory";
import Link from "next/link";

export default function ReadingHistoryWidget() {
  const { history } = useReadingHistory();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || history.length === 0) return null;

  return (
    <section
      aria-label="Truyện đọc gần đây"
      className="rounded-xl overflow-hidden"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        animationName: "fadeIn",
        animationDuration: "0.5s",
      }}
    >
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
        <div
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full"
          style={{
            background: "var(--pill2-bg)",
            border: "1px solid var(--pill2-border)",
            color: "var(--pill2-color)",
          }}
        >
          <span
            className="w-[22px] h-[22px] rounded-full flex items-center justify-center text-[11px] shrink-0"
            style={{ background: "var(--card)" }}
            aria-hidden="true"
          >
            🕐
          </span>
          <span className="text-[12px] font-black uppercase tracking-[.1em]">Nghe gần đây</span>
        </div>
        <Link
          href="/tai-khoan"
          aria-label="Xem toàn bộ lịch sử nghe"
          className="see-all-hist inline-flex items-center gap-1 px-4 py-2 rounded-full text-sm font-bold border-[1.5px] transition-all"
          style={{
            borderColor: "var(--pill2-border)",
            color: "var(--pill2-color)",
            background: "transparent",
          }}
        >
          Tất cả →
        </Link>
        <style>{`.see-all-hist:hover { background: var(--pill2-bg) !important; color: var(--pill2-color) !important; border-color: var(--pill2-border) !important; }`}</style>
      </div>

      {/* List */}
      <div>
        {history.slice(0, 5).map((item, i) => (
          <Link
            key={item.slug}
            href={`/truyen/${item.slug}`}
            aria-label={`Chi tiết truyện ${item.title}`}
            className="group flex items-center gap-3 px-3 py-2.5 transition-colors"
            style={{ borderBottom: "1px solid var(--border-soft)" }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = "var(--card)")}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = "transparent")}
          >
            <div
              className="shrink-0 w-9 h-12 rounded-lg flex items-center justify-center font-black text-lg"
              style={{ background: "rgba(232,88,10,0.15)", color: "var(--accent)", border: "1px solid rgba(232,88,10,0.3)" }}
            >
              {i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <h3
                className="truncate text-sm font-semibold transition-colors"
                style={{ color: "var(--text)" }}
              >
                {item.title}
              </h3>
            </div>
            <div className="shrink-0 text-right">
              <span className="block text-xs font-bold" style={{ color: "var(--accent)" }}>
                C.{item.chapterIndex || 1}
              </span>
              <span className="block text-xs" style={{ color: "var(--text-muted)" }} aria-hidden="true">
                Nghe tiếp
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
