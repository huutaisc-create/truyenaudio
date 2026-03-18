"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image"; // FIX LCP
import { BookOpen } from "lucide-react";

type Story = {
  id: string; title: string; slug: string;
  nominationCount: number; viewCount: number; likeCount: number; followCount: number;
  genres: { name: string }[];
  coverImage?: string | null;
  status?: string;
};

type Props = {
  topNominations: Story[];
  topViews: Story[];
  topLikes: Story[];
  topFollows: Story[];
};

const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : n.toString();

const TABS = [
  { key: 'nominations', label: 'Đề Cử',    emoji: '🏅' },
  { key: 'views',       label: 'Lượt Xem',  emoji: '👁' },
  { key: 'likes',       label: 'Yêu Thích', emoji: '❤️' },
  { key: 'follows',     label: 'Theo Dõi',  emoji: '🔔' },
];

export default function RankingTabs({ topNominations, topViews, topLikes, topFollows }: Props) {
  const [active, setActive] = useState('nominations');

  const lists: Record<string, Story[]> = {
    nominations: topNominations,
    views:       topViews,
    likes:       topLikes,
    follows:     topFollows,
  };

  const statOf = (story: Story) => {
    if (active === 'nominations') return fmt(story.nominationCount);
    if (active === 'views')       return fmt(story.viewCount);
    if (active === 'likes')       return fmt(story.likeCount);
    return fmt(story.followCount);
  };

  return (
    // FIX A11Y: thêm aria-label cho section
    <section aria-label="Xếp hạng truyện" className="bg-white rounded-xl border border-zinc-100 shadow-sm overflow-hidden">

      {/* FIX A11Y: tablist role cho tab bar */}
      <div
        role="tablist"
        aria-label="Lọc xếp hạng theo tiêu chí"
        className="flex items-center gap-2 px-3 py-3 border-b border-zinc-100"
      >
        {TABS.map(tab => (
          <button
            key={tab.key}
            role="tab"                              // FIX A11Y
            aria-selected={active === tab.key}      // FIX A11Y
            aria-controls="ranking-tabpanel"        // FIX A11Y
            onClick={() => setActive(tab.key)}
            className={`flex-1 h-9 px-2 rounded-full text-xs font-black uppercase tracking-wide transition-all border-[2px] flex items-center justify-center gap-1.5
              ${active === tab.key
                ? 'bg-[#e8580a] border-[#e8580a] text-white'
                : 'bg-white border-[#e8580a] text-[#e8580a] hover:bg-orange-50'
              }`}
          >
            <span aria-hidden="true">{tab.emoji}</span>
            <span className="hidden sm:inline">{tab.label}</span>
            {/* FIX A11Y: label cho screen reader trên mobile */}
            <span className="sr-only sm:hidden">{tab.label}</span>
          </button>
        ))}
        <Link
          href="/xep-hang"
          aria-label="Xem tất cả bảng xếp hạng"
          className="shrink-0 h-9 inline-flex items-center gap-1 px-3 rounded-full text-[11px] font-bold border-[1.5px] border-[#e8580a] text-[#e8580a] hover:bg-orange-50 transition-all"
        >
          Xem tất cả →
        </Link>
      </div>

      {/* FIX A11Y: tabpanel role */}
      <div
        id="ranking-tabpanel"
        role="tabpanel"
        aria-label={`Xếp hạng: ${TABS.find(t => t.key === active)?.label}`}
        className="p-4"
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {lists[active].slice(0, 8).map((story, i) => (
            <Link
              href={`/truyen/${story.slug}`}
              key={story.id}
              aria-label={`Hạng ${i + 1}: ${story.title}`} // FIX A11Y
              className="group relative rounded-lg overflow-hidden aspect-[3/4] bg-zinc-100 shadow-sm hover:shadow-md transition-all"
            >
              {story.coverImage ? (
                // FIX LCP: next/image thay <img> — tự convert WebP, lazy load đúng cách
                <Image
                  src={story.coverImage}
                  alt={`Ảnh bìa ${story.title}`} // FIX A11Y: alt mô tả
                  fill
                  sizes="(max-width: 640px) 45vw, 22vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  // FIX LCP: 2 card đầu visible ngay → priority
                  priority={i < 2}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-zinc-200 text-zinc-300">
                  <BookOpen className="h-8 w-8 opacity-20" aria-hidden="true" />
                </div>
              )}

              {/* Rank badge */}
              <div
                aria-hidden="true" // FIX A11Y: rank đã có trong aria-label của Link
                className={`absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shadow-md
                  ${i === 0 ? 'bg-yellow-400 text-white' : i === 1 ? 'bg-zinc-400 text-white' : i === 2 ? 'bg-amber-700 text-white' : 'bg-black/50 text-white'}`}
              >
                {i + 1}
              </div>

              {story.status === 'COMPLETED' && (
                <span className="absolute top-0 right-0 bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 uppercase">Full</span>
              )}

              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-2 pt-10 flex flex-col justify-end">
                <h3 className="text-xs font-bold text-white line-clamp-2 leading-tight group-hover:text-orange-300 transition-colors">
                  {story.title}
                </h3>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-white/60">{story.genres[0]?.name}</span>
                  <span className="text-[10px] font-bold text-orange-300" aria-hidden="true">{statOf(story)}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
