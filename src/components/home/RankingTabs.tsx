"use client";
import { useState } from "react";
import Link from "next/link";
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
    <div className="bg-white rounded-xl border border-zinc-100 shadow-sm overflow-hidden">

      {/* ── Tab bar Concept E ── */}
      <div className="flex items-center gap-2 px-3 py-3 border-b border-zinc-100">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActive(tab.key)}
            className={`flex-1 h-9 px-2 rounded-full text-xs font-black uppercase tracking-wide transition-all border-[2px] flex items-center justify-center gap-1.5
              ${active === tab.key
                ? 'bg-[#e8580a] border-[#e8580a] text-white'
                : 'bg-white border-[#e8580a] text-[#e8580a] hover:bg-orange-50'
              }`}
          >
            <span>{tab.emoji}</span>
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
        <Link href="/xep-hang"
          className="shrink-0 h-9 inline-flex items-center gap-1 px-3 rounded-full text-[11px] font-bold border-[1.5px] border-[#e8580a] text-[#e8580a] hover:bg-orange-50 transition-all">
          Xem tất cả →
        </Link>
      </div>

      {/* ── Grid 4x2 card — dùng chung style StoryCard ── */}
      <div className="p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {lists[active].slice(0, 8).map((story, i) => (
            <Link href={`/truyen/${story.slug}`} key={story.id}
              className="group relative rounded-lg overflow-hidden aspect-[3/4] bg-zinc-100 shadow-sm hover:shadow-md transition-all">

              {story.coverImage
                ? <img src={story.coverImage} alt={story.title} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                : <div className="w-full h-full flex items-center justify-center bg-zinc-200 text-zinc-300"><BookOpen className="h-8 w-8 opacity-20" /></div>
              }

              {/* Rank badge */}
              <div className={`absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shadow-md
                ${i === 0 ? 'bg-yellow-400 text-white' : i === 1 ? 'bg-zinc-400 text-white' : i === 2 ? 'bg-amber-700 text-white' : 'bg-black/50 text-white'}`}>
                {i + 1}
              </div>

              {story.status === 'COMPLETED' && (
                <span className="absolute top-0 right-0 bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 uppercase">Full</span>
              )}

              {/* title sát đáy đồng bộ StoryCard */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-2 pt-10 flex flex-col justify-end">
                <h3 className="text-xs font-bold text-white line-clamp-2 leading-tight group-hover:text-orange-300 transition-colors">{story.title}</h3>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-white/60">{story.genres[0]?.name}</span>
                  <span className="text-[10px] font-bold text-orange-300">{statOf(story)}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
