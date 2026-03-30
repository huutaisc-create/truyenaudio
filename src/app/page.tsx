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
// SHARED PILL COMPONENTS
// ─────────────────────────────────────────────────────

// Pill solid (cam) — dùng cho các section chính: Truyện Hot, Mới, Hoàn Thành
const SectionTitle = ({ emoji, label }: { emoji: string; label: string }) => (
  <div
    className="inline-flex items-center gap-2 px-4 py-2 rounded-full"
    style={{ background: "var(--accent)" }}
  >
    <span className="text-sm leading-none" aria-hidden="true">{emoji}</span>
    <span className="text-sm font-black uppercase tracking-[.08em] text-white">{label}</span>
  </div>
);

// Pill outline2 (vàng Nam / tím Nữ) — dùng cho sidebar: Thống Kê, Thể Loại, Mới Cập Nhật
const SidebarTitle = ({ emoji, label }: { emoji: string; label: string }) => (
  <div
    className="inline-flex items-center gap-2 px-4 py-2 rounded-full"
    style={{
      background: "var(--pill2-bg)",
      border: "1px solid var(--pill2-border)",
      color: "var(--pill2-color)",
    }}
  >
    <span className="text-sm leading-none" aria-hidden="true">{emoji}</span>
    <span className="text-sm font-black uppercase tracking-[.08em]">{label}</span>
  </div>
);

const SeeAllLink = ({ href, label }: { href: string; label: string }) => (
  <>
    <style>{`.see-all-link:hover { background: var(--accent) !important; color: #fff !important; }`}</style>
    <Link
      href={href}
      aria-label={label}
      className="see-all-link inline-flex items-center gap-1 px-4 py-2 rounded-full text-sm font-bold border-[1.5px] transition-all"
      style={{
        borderColor: "var(--accent)",
        color: "var(--accent)",
        background: "transparent",
      }}
    >
      Tất cả →
    </Link>
  </>
);

// ── StoryCard ──
const StoryCard = ({
  title, status, slug, coverImage, priority = false,
}: {
  title: string; status?: string; slug: string;
  coverImage?: string | null; priority?: boolean;
}) => (
  <div className="group cursor-pointer relative">
    <div
      className="relative aspect-[3/4] overflow-hidden rounded-lg shadow-sm transition-all group-hover:shadow-lg group-hover:-translate-y-0.5"
      style={{ background: "var(--card)", border: "1px solid var(--border)" }}
    >
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
          <div
            className="flex h-full w-full items-center justify-center"
            style={{ background: "var(--card2)" }}
          >
            <BookOpen className="h-10 w-10 opacity-20" aria-hidden="true" style={{ color: "var(--text-muted)" }} />
          </div>
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-x-0 bottom-0 p-2 pt-10 flex flex-col justify-end"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.4) 55%, transparent 100%)" }}
        >
          <h3 className="line-clamp-2 text-sm font-bold text-white leading-tight group-hover:text-orange-300 transition-colors">
            {title}
          </h3>
        </div>
      </Link>

      {status === "COMPLETED" && (
        <span className="absolute top-0 left-0 bg-red-600 text-white text-[9px] font-bold px-2 py-0.5 z-10 uppercase tracking-wider rounded-br-md">
          Full
        </span>
      )}

      {/* Nút NGHE */}
      <Link
        href={`/truyen/${slug}/nghe`}
        aria-label={`Nghe truyện ${title}`}
        className="absolute top-2 right-2 z-10 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[9px] font-bold backdrop-blur-sm transition-all shadow-sm"
        style={{
          background: "var(--hear-bg)",
          border: "1.5px solid var(--hear-border)",
          color: "var(--hear-color)",
        }}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 18v-6a9 9 0 0 1 18 0v6"/>
          <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z"/>
          <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
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
    db.story.findMany({ take: 8, orderBy: { viewCount: "desc" }, include: { genres: { take: 1 }, chapters: { orderBy: { index: "desc" }, take: 1, select: { index: true } } } }),
    db.story.findMany({ take: 15, orderBy: { updatedAt: "desc" }, include: { genres: { take: 1 }, chapters: { orderBy: { index: "desc" }, take: 1, select: { index: true, createdAt: true } } } }),
    db.story.findMany({ take: 8, orderBy: { nominationCount: "desc" }, include: { genres: { take: 1 } } }),
    db.story.findMany({ take: 8, orderBy: { viewCount: "desc" }, include: { genres: { take: 1 } } }),
    db.story.findMany({ take: 8, orderBy: { likeCount: "desc" }, include: { genres: { take: 1 } } }),
    db.story.findMany({ take: 8, orderBy: { followCount: "desc" }, include: { genres: { take: 1 } } }),
    db.story.findMany({ take: 8, orderBy: { createdAt: "desc" }, include: { genres: { take: 1 } } }),
    db.story.findMany({ take: 8, where: { status: "COMPLETED" }, orderBy: { updatedAt: "desc" }, include: { genres: { take: 1 } } }),
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
                  <StoryCard key={story.id} title={story.title} status={story.status} slug={story.slug} coverImage={story.coverImage} priority={i < 4} />
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
                    <StoryCard key={story.id} title={story.title} status={story.status} slug={story.slug} coverImage={story.coverImage} />
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
                    <StoryCard key={story.id} title={story.title} status={story.status} slug={story.slug} coverImage={story.coverImage} />
                  ))}
                </div>
              </div>
            </section>

          </div>

          {/* ── RIGHT SIDEBAR (3/12) ── */}
          <aside className="lg:col-span-3 space-y-6 mt-5" aria-label="Sidebar">

            {/* THỐNG KÊ */}
            <div
              className="hidden lg:block rounded-xl overflow-hidden"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                <SectionTitle emoji="📊" label="Thống Kê" />
              </div>
              <div className="grid grid-cols-2" style={{ borderTop: "1px solid var(--border)" }}>
                {[
                  { emoji: "📚", bg: "var(--stat-icon1)", val: fmt(totalStories),       label: "Bộ truyện" },
                  { emoji: "📖", bg: "var(--stat-icon2)", val: fmt(totalChapters),     label: "Chương" },
                  { emoji: "⭐", bg: "var(--stat-icon3)", val: String(GENRES.length),  label: "Thể loại" },
                  { emoji: "✨", bg: "var(--stat-icon4)",  val: `${newStories.length}+`, label: "Cập nhật/ngày" },
                ].map(({ emoji, bg, val, label }, i) => (
                  <div
                    key={label}
                    className="flex items-center gap-2.5 p-3"
                    style={{
                      borderRight: i % 2 === 0 ? "1px solid var(--border)" : "none",
                      borderBottom: i < 2 ? "1px solid var(--border)" : "none",
                    }}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-base"
                      style={{ background: bg }}
                      aria-hidden="true"
                    >
                      {emoji}
                    </div>
                    <div>
                      <div className="text-base font-bold leading-none" style={{ color: "var(--text)" }}>{val}</div>
                      <div className="text-[10px] mt-0.5 uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{label}</div>
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
            <section
              className="hidden lg:block rounded-xl overflow-hidden"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              aria-label="Thể loại truyện"
            >
              <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                <SidebarTitle emoji="🏷️" label="Thể Loại" />
              </div>
              <div className="p-4">
                <div className="flex flex-wrap gap-1.5">
                  <style>{`.genre-tag:hover { background: var(--accent) !important; color: #fff !important; border-color: var(--accent) !important; } .new-story-row:hover { background: var(--card) !important; }`}</style>
                  {GENRES.map((genre) => (
                    <Link
                      key={genre}
                      href={`/tim-kiem?the-loai=${encodeURIComponent(genre)}`}
                      className="genre-tag rounded-full px-3 py-1 text-xs font-medium transition-all"
                      style={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        color: "var(--text-muted)",
                      }}
                    >
                      {genre}
                    </Link>
                  ))}
                </div>
              </div>
            </section>

            {/* MỚI CẬP NHẬT */}
            <section
              className="hidden lg:block rounded-xl overflow-hidden"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              aria-label="Truyện mới cập nhật"
            >
              <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
                <SidebarTitle emoji="⚡" label="Mới Cập Nhật" />
                <SeeAllLink href="/xep-hang?tab=new" label="Xem tất cả truyện mới cập nhật" />
              </div>
              <div>
                {newStories.map((story) => {
                  const ch = story.chapters[0];
                  return (
                    <Link
                      href={`/truyen/${story.slug}`}
                      key={story.id}
                      aria-label={`${story.title}${ch ? `, chương ${ch.index}` : ""}`}
                      className="group new-story-row flex items-center gap-3 px-3 py-2.5 transition-colors"
                      style={{ borderBottom: "1px solid var(--border-soft)" }}
                    >
                      <div
                        className="shrink-0 w-9 h-12 rounded overflow-hidden relative"
                        style={{ background: "var(--card2)", border: "1px solid var(--border)" }}
                      >
                        {story.coverImage ? (
                          <Image src={story.coverImage} alt={`Ảnh bìa ${story.title}`} fill sizes="36px" className="object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center" style={{ color: "var(--text-soft)" }}>
                            <BookOpen size={13} aria-hidden="true" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="truncate text-sm font-semibold transition-colors" style={{ color: "var(--text)" }}>
                          {story.title}
                        </h4>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{story.genres[0]?.name}</span>
                          {story.author && (
                            <>
                              <span className="text-xs" style={{ color: "var(--border)" }} aria-hidden="true">·</span>
                              <span className="text-xs truncate max-w-[55px]" style={{ color: "var(--text-muted)" }}>{story.author}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        {ch && <span className="block text-xs font-bold" style={{ color: "var(--accent)" }}>C.{ch.index}</span>}
                        {ch && <span className="block text-xs" style={{ color: "var(--text-muted)" }}>{formatDistanceToNow(new Date(ch.createdAt), { addSuffix: false, locale: vi }).replace("khoảng ", "")}</span>}
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
