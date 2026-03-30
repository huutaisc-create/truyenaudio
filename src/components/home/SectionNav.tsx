"use client";
import { useState, useEffect, useRef } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";

const SECTIONS = [
  { id: "section-hot",       label: "Truyện Hot" },
  { id: "section-ranking",   label: "Xếp Hạng" },
  { id: "section-new",       label: "Truyện Mới" },
  { id: "section-completed", label: "Hoàn Thành" },
];

export default function SectionNav() {
  const [current, setCurrent] = useState(0);
  const currentRef = useRef(0);
  const lockRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (lockRef.current) return;
      const offsets = SECTIONS.map(s => {
        const el = document.getElementById(s.id);
        return el ? el.getBoundingClientRect().top : Infinity;
      });
      let best = 0;
      for (let i = 0; i < offsets.length; i++) {
        if (offsets[i] <= 80) best = i;
      }
      currentRef.current = best;
      setCurrent(best);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const goTo = (idx: number) => {
    if (idx < 0 || idx >= SECTIONS.length) return;
    const el = document.getElementById(SECTIONS[idx].id);
    if (!el) return;
    const top = Math.max(0, el.getBoundingClientRect().top + window.scrollY - 80);
    currentRef.current = idx;
    setCurrent(idx);
    window.scrollTo({ top, behavior: "smooth" });
    lockRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { lockRef.current = false; }, 1200);
  };

  const goUp   = () => goTo(currentRef.current - 1);
  const goDown = () => goTo(currentRef.current + 1);

  return (
    <nav
      aria-label="Điều hướng nhanh các section"
      className="fixed right-6 top-0 h-screen z-50 hidden lg:flex flex-col items-center justify-center pointer-events-none"
    >
      <div className="flex flex-col items-center gap-2 pointer-events-auto">

        {/* Nút Up */}
        <button
          onClick={goUp}
          disabled={current === 0}
          aria-label={current === 0 ? "Đã ở section đầu tiên" : `Lên section trước: ${SECTIONS[current - 1]?.label}`}
          aria-disabled={current === 0}
          className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            color: current === 0 ? "var(--text-soft)" : "var(--text-muted)",
            opacity: current === 0 ? 0.3 : 1,
            cursor: current === 0 ? "not-allowed" : "pointer",
            boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
          }}
          onMouseEnter={e => {
            if (current !== 0) {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)";
              (e.currentTarget as HTMLElement).style.color = "var(--accent)";
            }
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
            (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
          }}
        >
          <ChevronUp size={16} aria-hidden="true" />
        </button>

        {/* Dots */}
        <div className="flex flex-col gap-2 items-center py-1" role="list" aria-label="Danh sách sections">
          {SECTIONS.map((s, i) => (
            <button
              key={s.id}
              role="listitem"
              onClick={() => goTo(i)}
              aria-label={`Đến section: ${s.label}`}
              aria-current={i === current ? "location" : undefined}
              className="rounded-full transition-all duration-300"
              style={{
                width:  i === current ? 10 : 8,
                height: i === current ? 10 : 8,
                background: i === current ? "var(--accent)" : "var(--border)",
                cursor: "pointer",
                boxShadow: i === current ? "0 0 6px var(--accent)" : "none",
              }}
            />
          ))}
        </div>

        {/* Nút Down */}
        <button
          onClick={goDown}
          disabled={current === SECTIONS.length - 1}
          aria-label={current === SECTIONS.length - 1 ? "Đã ở section cuối cùng" : `Xuống section tiếp theo: ${SECTIONS[current + 1]?.label}`}
          aria-disabled={current === SECTIONS.length - 1}
          className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            color: current === SECTIONS.length - 1 ? "var(--text-soft)" : "var(--text-muted)",
            opacity: current === SECTIONS.length - 1 ? 0.3 : 1,
            cursor: current === SECTIONS.length - 1 ? "not-allowed" : "pointer",
            boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
          }}
          onMouseEnter={e => {
            if (current !== SECTIONS.length - 1) {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)";
              (e.currentTarget as HTMLElement).style.color = "var(--accent)";
            }
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
            (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
          }}
        >
          <ChevronDown size={16} aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
