import Link from "next/link";
import Image from "next/image";
import { BookOpen } from "lucide-react";
import React from "react";
import { formatNumber } from "@/lib/utils";

interface StoryMinimal {
  id: string;
  title: string;
  slug: string;
  coverImage: string | null;
  author: string;
  status: string;
  genres: { name: string }[];
  nominationCount?: number;
  viewCount?: number;
  ratingScore?: number;
  likeCount?: number;
  followCount?: number;
}

interface RankingColumnProps {
  title: string;
  icon?: React.ReactNode;
  stories: StoryMinimal[];
  countKey: keyof StoryMinimal;
  countLabel: string;
  accentColor: string;
  tab: string;
  isPriority?: boolean;
}

const RankingColumn = ({ title, stories, countKey, countLabel, accentColor, tab, isPriority = false }: RankingColumnProps) => {
  const top1 = stories[0];
  const others = stories.slice(1);

  return (
    <div className="flex flex-col gap-4">
      <div
        className="flex items-center justify-between pb-2"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <h2 className="text-sm font-black uppercase tracking-wide" style={{ color: "var(--text)" }}>
          {title}
        </h2>
        <Link
          href={`/xep-hang?tab=${tab}`}
          className="text-xs transition-colors"
          style={{ color: "var(--text-muted)" }}
          aria-label={`Xem tất cả bảng xếp hạng ${title}`}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = "var(--accent)")}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = "var(--text-muted)")}
        >
          Tất cả &gt;
        </Link>
      </div>

      {/* Top 1 */}
      {top1 && (
        <div className="flex gap-3">
          <div className="w-1/3 shrink-0 relative">
            <span className="absolute top-0 left-0 bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 z-10 rounded-br">
              NO.1
            </span>
            {top1.status === "COMPLETED" && (
              <span className="absolute top-0 right-0 bg-red-600 text-white text-[8px] font-bold px-1.5 py-0.5 z-10 uppercase tracking-wider">
                Full
              </span>
            )}
            <Link
              href={`/truyen/${top1.slug}`}
              className="block aspect-[2/3] rounded overflow-hidden shadow-md transition-shadow hover:shadow-lg"
              style={{ background: "var(--card2)", border: "1px solid var(--border)" }}
              aria-label={`Xem truyện ${top1.title}`}
            >
              {top1.coverImage ? (
                <Image
                  src={top1.coverImage}
                  alt={`Ảnh bìa truyện ${top1.title}`}
                  fill
                  sizes="(max-width: 640px) 30vw, (max-width: 1024px) 15vw, 8vw"
                  className="object-cover"
                  priority={isPriority}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center" style={{ color: "var(--text-soft)" }}>
                  <BookOpen className="w-6 h-6" aria-hidden="true" />
                </div>
              )}
            </Link>
          </div>
          <div className="flex-1 min-w-0 flex flex-col gap-1">
            <Link
              href={`/truyen/${top1.slug}`}
              className="font-bold text-sm line-clamp-2 leading-tight transition-colors"
              style={{ color: "var(--text)" }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = "var(--accent)")}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = "var(--text)")}
            >
              {top1.title}
            </Link>
            <div className="text-sm font-bold" style={{ color: accentColor }}>
              {formatNumber(top1[countKey] as number || 0)}{" "}
              <span className="text-[10px] font-normal" style={{ color: "var(--text-muted)" }}>{countLabel}</span>
            </div>
            <div className="text-[11px] truncate mt-auto" style={{ color: "var(--text-muted)" }}>
              {top1.genres[0]?.name}
            </div>
            <div className="text-[11px] truncate" style={{ color: "var(--text-soft)" }}>
              {top1.author}
            </div>
          </div>
        </div>
      )}

      {/* List 2–10 */}
      <div className="flex flex-col gap-3 mt-1">
        {others.map((story, idx) => (
          <div key={story.id} className="flex items-center gap-2">
            <span
              aria-label={`Hạng ${idx + 2}`}
              className="flex items-center justify-center w-5 h-5 rounded text-[11px] font-bold shrink-0"
              style={
                idx < 2
                  ? { background: "var(--pill-hot-bg)", color: "var(--accent)" }
                  : { background: "var(--card2)", color: "var(--text-muted)" }
              }
            >
              {idx + 2}
            </span>
            <Link
              href={`/truyen/${story.slug}`}
              className="flex-1 min-w-0 text-sm truncate transition-colors"
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = "var(--accent)")}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = "var(--text-muted)")}
            >
              {story.title}
            </Link>
            <span className="text-[11px] shrink-0" style={{ color: "var(--text-soft)" }} aria-hidden="true">
              {formatNumber(story[countKey] as number || 0)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function RankingBoard({ topNominations, topViews, topLikes, topFollows }: {
  topNominations: StoryMinimal[];
  topViews: StoryMinimal[];
  topLikes: StoryMinimal[];
  topFollows: StoryMinimal[];
}) {
  return (
    <section
      aria-label="Bảng xếp hạng truyện"
      className="rounded-xl p-4 sm:p-6 mb-8"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        <RankingColumn
          title="Đề cử"
          stories={topNominations}
          countKey="nominationCount"
          countLabel="Đề cử"
          accentColor="var(--accent)"
          tab="nomination"
          isPriority={true}
        />
        <RankingColumn
          title="Xem nhiều"
          stories={topViews}
          countKey="viewCount"
          countLabel="Lượt xem"
          accentColor="var(--accent)"
          tab="hot"
        />
        <RankingColumn
          title="Yêu thích"
          stories={topLikes}
          countKey="likeCount"
          countLabel="Lượt thích"
          accentColor="var(--accent2)"
          tab="like"
        />
        <RankingColumn
          title="Theo dõi nhiều"
          stories={topFollows}
          countKey="followCount"
          countLabel="Lượt theo dõi"
          accentColor="var(--rank-top)"
          tab="follow"
        />
      </div>
    </section>
  );
}
