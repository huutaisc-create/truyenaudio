import { Flame, Clock, BookOpen, User, BookMarked, Star, Sparkles } from "lucide-react";
import ReadingHistoryWidget from "@/components/common/ReadingHistoryWidget";
import db from "@/lib/db";
import { GENRES } from "@/lib/constants";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import RecentReads from "@/components/home/RecentReads";
import RankingTabs from "@/components/home/RankingTabs";
import SectionNav from "@/components/home/SectionNav";

// ── StoryCard dùng chung cho tất cả grid ──
const StoryCard = ({ title, status, slug, coverImage, hoverColor = "text-orange-300" }: {
  title: string; status?: string; slug: string; coverImage?: string | null; hoverColor?: string;
}) => (
  <div className="group cursor-pointer relative">
    <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-zinc-100 shadow-sm transition-all group-hover:shadow-md">
      <Link href={`/truyen/${slug}`} className="block absolute inset-0 z-0">
        {coverImage ? (
          <img src={coverImage} alt={title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-zinc-300 bg-zinc-200">
            <BookOpen className="h-10 w-10 opacity-20" />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-2 pt-10 flex flex-col justify-end">
          <h3 className={`line-clamp-2 text-sm font-bold text-white group-hover:${hoverColor} transition-colors leading-tight`}>{title}</h3>
        </div>
      </Link>
      {status === "COMPLETED" && (
        <span className="absolute top-0 left-0 bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 shadow-sm z-10 uppercase tracking-wider rounded-br-md">Full</span>
      )}
      {/* Corner buttons — góc trên phải */}
      <div className="absolute top-1.5 right-1.5 flex flex-col gap-1 z-10">
        <Link href={`/truyen/${slug}/nghe`}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white border border-[#e8580a] shadow-md hover:bg-[#e8580a] hover:text-white transition-all peer/nghe"
          style={{ color: '#e8580a' }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#e8580a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z"/><path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
          </svg>
          <span className="text-[8px] font-black uppercase tracking-[.07em]">Nghe</span>
        </Link>
        <Link href={`/truyen/${slug}`}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white border border-[#e8580a] shadow-md hover:bg-[#e8580a] hover:text-white transition-all"
          style={{ color: '#e8580a' }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#e8580a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
          </svg>
          <span className="text-[8px] font-black uppercase tracking-[.07em]">Đọc</span>
        </Link>
      </div>
    </div>
  </div>
);

export const revalidate = 60;

export default async function Home() {
  const [hotStories, newStories, topNominations, topViews, topLikes, topFollows, createdStories, completedStories, totalStories, totalChapters] = await Promise.all([
    db.story.findMany({ take: 8, orderBy: { viewCount: 'desc' }, include: { genres: { take: 1 }, chapters: { orderBy: { index: 'desc' }, take: 1, select: { index: true } } } }),
    db.story.findMany({ take: 15, orderBy: { updatedAt: 'desc' }, include: { genres: { take: 1 }, chapters: { orderBy: { index: 'desc' }, take: 1, select: { index: true, createdAt: true } } } }),
    db.story.findMany({ take: 8, orderBy: { nominationCount: 'desc' }, include: { genres: { take: 1 } } }),
    db.story.findMany({ take: 8, orderBy: { viewCount: 'desc' }, include: { genres: { take: 1 } } }),
    db.story.findMany({ take: 8, orderBy: { likeCount: 'desc' }, include: { genres: { take: 1 } } }),
    db.story.findMany({ take: 8, orderBy: { followCount: 'desc' }, include: { genres: { take: 1 } } }),
    db.story.findMany({ take: 8, orderBy: { createdAt: 'desc' }, include: { genres: { take: 1 } } }),
    db.story.findMany({ take: 8, where: { status: 'COMPLETED' }, orderBy: { updatedAt: 'desc' }, include: { genres: { take: 1 } } }),
    db.story.count(),
    db.chapter.count(),
  ]);

  const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(0)}K` : n.toString();

  return (
    <div className=" pb-24">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">

          {/* ── LEFT (9/12) ── */}
          <div className="lg:col-span-9 space-y-10">

            <RecentReads />

            {/* Hot Stories */}
            <section id="section-hot" className="scroll-mt-20">
              <div className="py-5 flex items-center justify-between">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border-[2.5px] border-[#e8580a] text-[#e8580a] bg-white">
                  <span className="w-[22px] h-[22px] bg-white rounded-full flex items-center justify-center text-[11px] shrink-0">🔥</span>
                  <span className="text-[12px] font-black uppercase tracking-[.1em]">Truyện Hot</span>
                </div>
                <Link href="/xep-hang?tab=hot"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold border-[1.5px] border-[#e8580a] text-[#e8580a] bg-white hover:bg-orange-50 transition-all">
                  Tất cả →
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                {hotStories.map(story => (
                  <StoryCard key={story.id} title={story.title} status={story.status} slug={story.slug} coverImage={story.coverImage} hoverColor="text-orange-300" />
                ))}
              </div>
            </section>

            <section id="section-ranking" className="scroll-mt-20">
              <div className="hidden lg:block">
              <RankingTabs
                topNominations={topNominations}
                topViews={topViews}
                topLikes={topLikes}
                topFollows={topFollows}
              />
              </div>
            </section>

            <section id="section-new" className="scroll-mt-20">
              <div className="hidden lg:block">
              <div className="py-5 flex items-center justify-between">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border-[2.5px] border-[#e8580a] text-[#e8580a] bg-white">
                  <span className="w-[22px] h-[22px] bg-white rounded-full flex items-center justify-center text-[11px] shrink-0">🕐</span>
                  <span className="text-[12px] font-black uppercase tracking-[.1em]">Truyện Mới</span>
                </div>
                <Link href="/xep-hang?tab=new"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold border-[1.5px] border-[#e8580a] text-[#e8580a] bg-white hover:bg-orange-50 transition-all">
                  Xem tất cả →
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                {createdStories.map(story => (
                  <StoryCard key={story.id} title={story.title} status={story.status} slug={story.slug} coverImage={story.coverImage} hoverColor="text-green-300" />
                ))}
              </div>
              </div>
            </section>

            <section id="section-completed" className="scroll-mt-20">
              <div className="hidden lg:block">
              <div className="py-5 flex items-center justify-between">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border-[2.5px] border-[#e8580a] text-[#e8580a] bg-white">
                  <span className="w-[22px] h-[22px] bg-white rounded-full flex items-center justify-center text-[11px] shrink-0">📖</span>
                  <span className="text-[12px] font-black uppercase tracking-[.1em]">Truyện Đã Hoàn Thành</span>
                </div>
                <Link href="/xep-hang?tab=completed"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold border-[1.5px] border-[#e8580a] text-[#e8580a] bg-white hover:bg-orange-50 transition-all">
                  Xem tất cả →
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                {completedStories.map(story => (
                  <StoryCard key={story.id} title={story.title} status={story.status} slug={story.slug} coverImage={story.coverImage} hoverColor="text-blue-300" />
                ))}
              </div>
              </div>
            </section>

          </div>

          {/* ── RIGHT (3/12) ── */}
          <aside className="lg:col-span-3 space-y-6 mt-5">

            <div className="hidden lg:block bg-white rounded-xl border border-zinc-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-orange-100">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border-[2.5px] border-[#e8580a] text-[#e8580a] bg-white">
                  <span className="w-[22px] h-[22px] bg-white rounded-full flex items-center justify-center text-[11px] shrink-0">📊</span>
                  <span className="text-[12px] font-black uppercase tracking-[.1em]">Thống Kê</span>
                </div>
              </div>
              <div className="grid grid-cols-2 divide-x divide-y divide-zinc-50">
                {[
                  { icon: <BookMarked className="h-4 w-4 text-brand-primary" />, bg: 'bg-orange-50', val: fmt(totalStories), label: 'Bộ truyện' },
                  { icon: <BookOpen className="h-4 w-4 text-blue-500" />,        bg: 'bg-blue-50',   val: fmt(totalChapters), label: 'Chương' },
                  { icon: <Star className="h-4 w-4 text-purple-500" />,          bg: 'bg-purple-50', val: String(GENRES.length), label: 'Thể loại' },
                  { icon: <Sparkles className="h-4 w-4 text-green-500" />,       bg: 'bg-green-50',  val: `${newStories.length}+`, label: 'Cập nhật/ngày' },
                ].map(({ icon, bg, val, label }) => (
                  <div key={label} className="flex items-center gap-2.5 p-3">
                    <div className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center shrink-0`}>{icon}</div>
                    <div>
                      <div className="text-base font-bold text-zinc-800 leading-none">{val}</div>
                      <div className="text-xs text-zinc-400 mt-0.5">{label}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="hidden lg:block">
              <ReadingHistoryWidget />
            </div>

            <section className="hidden lg:block bg-white rounded-xl border border-zinc-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-orange-100">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border-[2.5px] border-[#e8580a] text-[#e8580a] bg-white">
                  <span className="w-[22px] h-[22px] bg-white rounded-full flex items-center justify-center text-[11px] shrink-0">🏷️</span>
                  <span className="text-[12px] font-black uppercase tracking-[.1em]">Thể Loại</span>
                </div>
              </div>
              <div className="p-4">
                <div className="flex flex-wrap gap-1.5">
                  {GENRES.map((genre) => (
                    <Link
                      key={genre}
                      href={`/tim-kiem?the-loai=${encodeURIComponent(genre)}`}
                      className="rounded-md bg-zinc-50 border border-zinc-100 px-2.5 py-1 text-sm font-medium text-zinc-600 hover:bg-orange-50 hover:text-brand-primary hover:border-orange-200 transition-all"
                    >
                      {genre}
                    </Link>
                  ))}
                </div>
              </div>
            </section>

            <section className="hidden lg:block bg-white rounded-xl border border-zinc-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-orange-100 flex items-center justify-between">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border-[2.5px] border-[#e8580a] text-[#e8580a] bg-white">
                  <span className="w-[22px] h-[22px] bg-white rounded-full flex items-center justify-center text-[11px] shrink-0">⚡</span>
                  <span className="text-[12px] font-black uppercase tracking-[.1em]">Mới Cập Nhật</span>
                </div>
                <Link href="/xep-hang?tab=new"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-white text-[#e8580a] border border-[#e8580a] hover:bg-orange-50 transition-all">
                  Tất cả →
                </Link>
              </div>
              <div className="divide-y divide-zinc-50">
                {newStories.map((story) => {
                  const ch = story.chapters[0];
                  return (
                    <Link href={`/truyen/${story.slug}`} key={story.id}
                      className="group flex items-center gap-3 px-3 py-2.5 hover:bg-orange-50 transition-colors">
                      <div className="shrink-0 w-9 h-12 rounded overflow-hidden bg-zinc-200">
                        {story.coverImage
                          ? <img src={story.coverImage} alt={story.title} className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center text-zinc-300"><BookOpen size={13} /></div>
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="truncate text-sm font-semibold text-zinc-800 group-hover:text-brand-primary transition-colors">{story.title}</h4>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-xs text-zinc-400">{story.genres[0]?.name}</span>
                          {story.author && <><span className="text-xs text-zinc-300">·</span><span className="text-xs text-zinc-400 truncate max-w-[55px]">{story.author}</span></>}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        {ch && <span className="block text-xs font-bold text-zinc-600">C.{ch.index}</span>}
                        {ch && <span className="block text-xs text-zinc-400">{formatDistanceToNow(new Date(ch.createdAt), { addSuffix: false, locale: vi }).replace('khoảng ', '')}</span>}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>

          </aside>
        </div>
      </div>
      <SectionNav />
    </div>
  );
}
