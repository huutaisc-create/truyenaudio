import { BookOpen, BookMarked, Star, Sparkles } from "lucide-react";
import Image from "next/image";
import ReadingHistoryWidget from "@/components/common/ReadingHistoryWidget";
import db from "@/lib/db";
import { GENRES } from "@/lib/constants";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import RecentReads from "@/components/home/RecentReads";
import RankingTabs from "@/components/home/RankingTabs";
import SectionNav from "@/components/home/SectionNav";

// ─────────────────────────────────────────────────────
// SHARED PILL COMPONENTS — đồng bộ toàn trang
// ─────────────────────────────────────────────────────

// Pill title: nền cam, chữ trắng, font 14px
const SectionTitle = ({ emoji, label }: { emoji: string; label: string }) => (
  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#e8580a] text-white">
    <span className="text-sm leading-none" aria-hidden="true">{emoji}</span>
    <span className="text-sm font-black uppercase tracking-[.08em]">{label}</span>
  </div>
);

// Pill "Tất cả": viền cam → hover nền cam chữ trắng
const SeeAllLink = ({ href, label }: { href: string; label: string }) => (
  <Link
    href={href}
    aria-label={label}
    className="inline-flex items-center gap-1 px-4 py-2 rounded-full text-sm font-bold border-[1.5px] border-[#e8580a] text-[#e8580a] bg-white hover:bg-[#e8580a] hover:text-white transition-all"
  >
    Tất cả →
  </Link>
);

// ── StoryCard ──
const StoryCard = ({
  title, status, slug, coverImage,
  hoverColor = "text-orange-300",
  priority = false,
}: {
  title: string; status?: string; slug: string;
  coverImage?: string | null; hoverColor?: string; priority?: boolean;
}) => (
  <div className="group cursor-pointer relative">
    <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-zinc-100 shadow-sm transition-all group-hover:shadow-md">

      <Link href={`/truyen/${slug}`} className="block absolute inset-0 z-0" aria-label={`Xem truyện ${title}`}>
        {coverImage ? (
          <Image
            src={coverImage}
            alt={`Ảnh bìa ${title}`}
            fill
            sizes="(max-width: 640px) 45vw, (max-width: 768px) 30vw, (max-width: 1024px) 22vw, 18vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            priority={priority}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-zinc-300 bg-zinc-200">
            <BookOpen className="h-10 w-10 opacity-20" aria-hidden="true" />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-2 pt-10 flex flex-col justify-end">
          <h3 className={`line-clamp-2 text-base font-bold text-white group-hover:${hoverColor} transition-colors leading-tight`}>{title}</h3>
        </div>
      </Link>

      {status === "COMPLETED" && (
        <span className="absolute top-0 left-0 bg-red-600 text-white text-sm font-bold px-2 py-0.5 shadow-sm z-10 uppercase tracking-wider rounded-br-md">Full</span>
      )}

      {/* Nút NGHE — outline style, click ảnh = đọc */}
      <Link
        href={`/truyen/${slug}/nghe`}
        aria-label={`Nghe truyện ${title}`}
        className="absolute top-2 right-2 z-10 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border-2 border-white/80 bg-black/30 text-white text-sm font-bold backdrop-blur-sm hover:bg-[#e8580a] hover:border-[#e8580a] transition-all shadow-sm"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z"/><path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
        </svg>
        Nghe
      </Link>

    </div>
  </div>
);

export const revalidate = 60;

export default async function Home() {
  const [
    hotStories, newStories,
    topNominations, topViews, topLikes, topFollows,
    createdStories, completedStories,
    totalStories, totalChapters,
  ] = await Promise.all([
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
    <div className="pb-24">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">

          {/* ── LEFT (9/12) ── */}
          <div className="lg:col-span-9 space-y-10">

            <RecentReads />

            {/* TRUYỆN HOT */}
            <section id="section-hot" className="scroll-mt-20" aria-label="Truyện Hot">
              <div className="py-5 flex items-center justify-between">
                <SectionTitle emoji="🔥" label="Truyện Hot" />
                <SeeAllLink href="/xep-hang?tab=hot" label="Xem tất cả truyện hot" />
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                {hotStories.map((story, i) => (
                  <StoryCard key={story.id} title={story.title} status={story.status} slug={story.slug} coverImage={story.coverImage} hoverColor="text-orange-300" priority={i < 4} />
                ))}
              </div>
            </section>

            {/* XẾP HẠNG */}
            <section id="section-ranking" className="scroll-mt-20" aria-label="Xếp hạng">
              <div className="hidden lg:block">
                <RankingTabs
                  topNominations={topNominations}
                  topViews={topViews}
                  topLikes={topLikes}
                  topFollows={topFollows}
                />
              </div>
            </section>

            {/* TRUYỆN MỚI */}
            <section id="section-new" className="scroll-mt-20" aria-label="Truyện mới">
              <div className="hidden lg:block">
                <div className="py-5 flex items-center justify-between">
                  <SectionTitle emoji="🕐" label="Truyện Mới" />
                  <SeeAllLink href="/xep-hang?tab=new" label="Xem tất cả truyện mới" />
                </div>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                  {createdStories.map(story => (
                    <StoryCard key={story.id} title={story.title} status={story.status} slug={story.slug} coverImage={story.coverImage} hoverColor="text-green-300" />
                  ))}
                </div>
              </div>
            </section>

            {/* TRUYỆN HOÀN THÀNH */}
            <section id="section-completed" className="scroll-mt-20" aria-label="Truyện hoàn thành">
              <div className="hidden lg:block">
                <div className="py-5 flex items-center justify-between">
                  <SectionTitle emoji="📖" label="Truyện Đã Hoàn Thành" />
                  <SeeAllLink href="/xep-hang?tab=completed" label="Xem tất cả truyện hoàn thành" />
                </div>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                  {completedStories.map(story => (
                    <StoryCard key={story.id} title={story.title} status={story.status} slug={story.slug} coverImage={story.coverImage} hoverColor="text-blue-300" />
                  ))}
                </div>
              </div>
            </section>

          </div>

          {/* ── RIGHT SIDEBAR (3/12) ── */}
          <aside className="lg:col-span-3 space-y-6 mt-5" aria-label="Sidebar">

            {/* THỐNG KÊ */}
            <div className="hidden lg:block bg-white rounded-xl border border-zinc-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-orange-100">
                <SectionTitle emoji="📊" label="Thống Kê" />
              </div>
              <div className="grid grid-cols-2 divide-x divide-y divide-zinc-50">
                {[
                  { icon: <BookMarked className="h-4 w-4 text-brand-primary" aria-hidden="true" />, bg: 'bg-orange-50', val: fmt(totalStories), label: 'Bộ truyện' },
                  { icon: <BookOpen className="h-4 w-4 text-blue-500" aria-hidden="true" />,        bg: 'bg-blue-50',   val: fmt(totalChapters), label: 'Chương' },
                  { icon: <Star className="h-4 w-4 text-purple-500" aria-hidden="true" />,          bg: 'bg-purple-50', val: String(GENRES.length), label: 'Thể loại' },
                  { icon: <Sparkles className="h-4 w-4 text-green-500" aria-hidden="true" />,       bg: 'bg-green-50',  val: `${newStories.length}+`, label: 'Cập nhật/ngày' },
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

            {/* READING HISTORY */}
            <div className="hidden lg:block">
              <ReadingHistoryWidget />
            </div>

            {/* THỂ LOẠI */}
            <section className="hidden lg:block bg-white rounded-xl border border-zinc-100 shadow-sm overflow-hidden" aria-label="Thể loại truyện">
              <div className="px-4 py-3 border-b border-orange-100">
                <SectionTitle emoji="🏷️" label="Thể Loại" />
              </div>
              <div className="p-4">
                <div className="flex flex-wrap gap-1.5">
                  {GENRES.map((genre) => (
                    <Link
                      key={genre}
                      href={`/tim-kiem?the-loai=${encodeURIComponent(genre)}`}
                      className="rounded-full bg-zinc-50 border border-zinc-200 px-3 py-1 text-sm font-medium text-zinc-600 hover:bg-[#e8580a] hover:text-white hover:border-[#e8580a] transition-all"
                    >
                      {genre}
                    </Link>
                  ))}
                </div>
              </div>
            </section>

            {/* MỚI CẬP NHẬT */}
            <section className="hidden lg:block bg-white rounded-xl border border-zinc-100 shadow-sm overflow-hidden" aria-label="Truyện mới cập nhật">
              <div className="px-4 py-3 border-b border-orange-100 flex items-center justify-between">
                <SectionTitle emoji="⚡" label="Mới Cập Nhật" />
                <SeeAllLink href="/xep-hang?tab=new" label="Xem tất cả truyện mới cập nhật" />
              </div>
              <div className="divide-y divide-zinc-50">
                {newStories.map((story) => {
                  const ch = story.chapters[0];
                  return (
                    <Link
                      href={`/truyen/${story.slug}`}
                      key={story.id}
                      aria-label={`${story.title}${ch ? `, chương ${ch.index}` : ''}`}
                      className="group flex items-center gap-3 px-3 py-2.5 hover:bg-orange-50 transition-colors"
                    >
                      <div className="shrink-0 w-9 h-12 rounded overflow-hidden bg-zinc-200 relative">
                        {story.coverImage ? (
                          <Image src={story.coverImage} alt={`Ảnh bìa ${story.title}`} fill sizes="36px" className="object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-300">
                            <BookOpen size={13} aria-hidden="true" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="truncate text-sm font-semibold text-zinc-800 group-hover:text-brand-primary transition-colors">{story.title}</h4>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-xs text-zinc-400">{story.genres[0]?.name}</span>
                          {story.author && (
                            <><span className="text-xs text-zinc-300" aria-hidden="true">·</span>
                            <span className="text-xs text-zinc-400 truncate max-w-[55px]">{story.author}</span></>
                          )}
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
