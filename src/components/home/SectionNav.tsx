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
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
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
    timerRef.current = setTimeout(() => {
      lockRef.current = false;
    }, 1200);
  };

  const goUp   = () => goTo(currentRef.current - 1);
  const goDown = () => goTo(currentRef.current + 1);

  return (
    // FIX A11Y: thêm nav + aria-label cho toàn bộ widget
    <nav
      aria-label="Điều hướng nhanh các section"
      className="fixed right-6 top-0 h-screen z-50 hidden lg:flex flex-col items-center justify-center pointer-events-none"
    >
      <div className="flex flex-col items-center gap-2 pointer-events-auto">

        {/* FIX A11Y: aria-label + aria-disabled cho nút Up */}
        <button
          onClick={goUp}
          disabled={current === 0}
          aria-label={
            current === 0
              ? "Đã ở section đầu tiên"
              : `Lên section trước: ${SECTIONS[current - 1]?.label}`
          }
          aria-disabled={current === 0}
          className={`w-8 h-8 rounded-full bg-white border border-zinc-200 shadow-md flex items-center justify-center transition-all
            ${current === 0 ? 'opacity-30 cursor-not-allowed' : 'text-zinc-400 hover:text-brand-primary hover:border-brand-primary'}`}
        >
          <ChevronUp size={16} aria-hidden="true" />
        </button>

        {/* FIX A11Y: mỗi dot có aria-label + aria-current */}
        <div className="flex flex-col gap-2 items-center py-1" role="list" aria-label="Danh sách sections">
          {SECTIONS.map((s, i) => (
            <button
              key={s.id}
              role="listitem"
              onClick={() => goTo(i)}
              aria-label={`Đến section: ${s.label}`}
              aria-current={i === current ? "location" : undefined} // FIX A11Y
              className={`rounded-full transition-all duration-300 ${
                i === current ? "w-2.5 h-2.5 bg-brand-primary shadow-sm" : "w-2 h-2 bg-zinc-300 hover:bg-zinc-400"
              }`}
            />
          ))}
        </div>

        {/* FIX A11Y: aria-label + aria-disabled cho nút Down */}
        <button
          onClick={goDown}
          disabled={current === SECTIONS.length - 1}
          aria-label={
            current === SECTIONS.length - 1
              ? "Đã ở section cuối cùng"
              : `Xuống section tiếp theo: ${SECTIONS[current + 1]?.label}`
          }
          aria-disabled={current === SECTIONS.length - 1}
          className={`w-8 h-8 rounded-full bg-white border border-zinc-200 shadow-md flex items-center justify-center transition-all
            ${current === SECTIONS.length - 1 ? 'opacity-30 cursor-not-allowed' : 'text-zinc-400 hover:text-brand-primary hover:border-brand-primary'}`}
        >
          <ChevronDown size={16} aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
