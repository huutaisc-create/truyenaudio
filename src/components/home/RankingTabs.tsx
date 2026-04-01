"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
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
  { key: "nominations", label: "Đề Cử",    emoji: "🏅" },
  { key: "views",       label: "Lượt Xem",  emoji: "👁" },
  { key: "likes",       label: "Yêu Thích", emoji: "❤️" },
  { key: "follows",     label: "Theo Dõi",  emoji: "🔔" },
];

export default function RankingTabs({ topNominations, topViews, topLikes, topFollows }: Props) {
  const [active, setActive] = useState("nominations");

  const lists: Record<string, Story[]> = {
    nominations: topNominations,
    views:       topViews,
    likes:       topLikes,
    follows:     topFollows,
  };

  const statOf = (story: Story) => {
    if (active === "nominations") return fmt(story.nominationCount);
    if (active === "views")       return fmt(story.viewCount);
    if (active === "likes")       return fmt(story.likeCount);
    return fmt(story.followCount);
  };

  return (
    <section
      aria-label="Xếp hạng truyện"
      className="rounded-xl overflow-hidden"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      {/* Tab bar — không còn pill header */}
      <style>{`
        .ranking-tab-inactive:hover { background: var(--pill2-bg) !important; }
        .ranking-see-all:hover { background: var(--pill2-bg) !important; color: var(--pill2-color) !important; border-color: var(--pill2-border) !important; }
      `}</style>
      <div
        role="tablist"
        aria-label="Lọc xếp hạng theo tiêu chí"
        className="flex items-center gap-1.5 px-3 py-3"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        {TABS.map(tab => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={active === tab.key}
            aria-controls="ranking-tabpanel"
            onClick={() => setActive(tab.key)}
            className={`flex-1 h-8 px-2 rounded-full text-xs font-black uppercase tracking-wide transition-all flex items-center justify-center gap-1 cursor-pointer ${active !== tab.key ? 'ranking-tab-inactive' : ''}`}
            style={active === tab.key
              ? { background: "var(--pill2-color)", border: "1px solid var(--pill2-border)", color: "var(--bg)" }
              : { background: "transparent", border: "1px solid var(--pill2-border)", color: "var(--pill2-color)" }
            }
          >
            <span aria-hidden="true">{tab.emoji}</span>
            <span className="hidden sm:inline">{tab.label}</span>
            <span className="sr-only sm:hidden">{tab.label}</span>
          </button>
        ))}
        <Link
          href="/xep-hang"
          aria-label="Xem tất cả bảng xếp hạng"
          className="ranking-see-all shrink-0 h-8 inline-flex items-center gap-1 px-3 rounded-full text-[11px] font-bold transition-all"
          style={{ border: "1px solid var(--pill2-border)", color: "var(--pill2-color)" }}
        >
          Tất cả →
        </Link>
      </div>

      {/* Tab panel */}
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
              aria-label={`Hạng ${i + 1}: ${story.title}`}
              className="group relative rounded-lg overflow-hidden aspect-[3/4] shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
              style={{ background: "var(--card)", border: "1px solid var(--border)" }}
            >
              {story.coverImage ? (
                <Image
                  src={story.coverImage}
                  alt={`Ảnh bìa ${story.title}`}
                  fill
                  sizes="(max-width: 640px) 45vw, 22vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  priority={i < 2}
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center"
                  style={{ background: "var(--card2)" }}
                >
                  <BookOpen className="h-8 w-8 opacity-20" aria-hidden="true" style={{ color: "var(--text-muted)" }} />
                </div>
              )}

              {/* Rank badge */}
              <div
                aria-hidden="true"
                className="absolute top-2 left-2 w-[26px] h-[26px] rounded-full flex items-center justify-center text-xs font-black shadow-md"
                style={
                  i === 0 ? { background: "var(--accent2)", color: "var(--bg)" }
                  : i === 1 ? { background: "var(--text-muted)", color: "#fff" }
                  : i === 2 ? { background: "#CD7F32", color: "#fff" }
                  : { background: "var(--card2)", color: "var(--text)", fontSize: 11 }
                }
              >
                {i + 1}
              </div>

              {story.status === "COMPLETED" && (
                <span className="absolute top-0 right-0 bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 uppercase z-10">Full</span>
              )}

              <div
                className="absolute inset-x-0 bottom-0 p-2 pt-10 flex flex-col justify-end"
                style={{ background: "linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.4) 55%, transparent 100%)" }}
              >
                <h3 className="text-xs font-bold text-white line-clamp-2 leading-tight group-hover:text-orange-300 transition-colors">
                  {story.title}
                </h3>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-white/60">{story.genres[0]?.name}</span>
                  <span
                    className="text-[10px] font-bold"
                    style={{ color: "var(--accent2)" }}
                    aria-hidden="true"
                  >
                    {statOf(story)}
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
