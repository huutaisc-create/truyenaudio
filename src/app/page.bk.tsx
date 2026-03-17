import { ChevronRight, Flame, Sparkles, Clock, BookOpen, User } from "lucide-react";
import ReadingHistoryWidget from "@/components/common/ReadingHistoryWidget";
import db from "@/lib/db";
import { GENRES } from "@/lib/constants";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import RecentReads from "@/components/home/RecentReads";
import RankingBoard from "@/components/home/RankingBoard";

const StoryCard = ({ title, category, status, slug, coverImage }: { title: string; category?: string; status?: string; slug: string; coverImage?: string | null }) => (
  <Link href={`/truyen/${slug}`} className="group cursor-pointer block">
    <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-zinc-100 shadow-sm transition-all group-hover:shadow-md">
      {coverImage ? (
        <img src={coverImage} alt={title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-zinc-300 bg-zinc-200">
          <BookOpen className="h-10 w-10 opacity-20" />
        </div>
      )}

      {/* Overlay for Title */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 pt-8">
        <h3 className="line-clamp-2 text-xs font-bold text-white group-hover:text-brand-primary transition-colors">{title}</h3>
      </div>

      {/* Full Badge if status is Full */}
      {status === "COMPLETED" && (
        <span className="absolute top-0 right-0 bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 shadow-sm z-10 uppercase tracking-wider">
          Full
        </span>
      )}
    </div>
  </Link>
);

export const revalidate = 60; // Revalidate every 60 seconds

export default async function Home() {

  const [hotStories, newStories, topNominations, topLikes, topFollows, createdStories, completedStories] = await Promise.all([
    // Fetch Hot Stories (Views) - Top 12 for Grid
    db.story.findMany({
      take: 12,
      orderBy: { viewCount: 'desc' },
      include: {
        genres: { take: 1 },
        chapters: { orderBy: { index: 'desc' }, take: 1, select: { index: true } }
      }
    }),
    // Fetch Recently Updated Stories (Sidebar) - Take 15
    db.story.findMany({
      take: 15,
      orderBy: { updatedAt: 'desc' },
      include: {
        genres: { take: 1 },
        chapters: { orderBy: { index: 'desc' }, take: 1, select: { index: true, createdAt: true } }
      }
    }),
    // Ranking: Nominations
    db.story.findMany({
      take: 10,
      orderBy: { nominationCount: 'desc' },
      include: { genres: { take: 1 } }
    }),
    // Ranking: Likes
    db.story.findMany({
      take: 10,
      orderBy: { likeCount: 'desc' },
      include: { genres: { take: 1 } }
    }),
    // Ranking: Follows
    db.story.findMany({
      take: 10,
      orderBy: { followCount: 'desc' },
      include: { genres: { take: 1 } }
    }),
    // New Stories (Created Date)
    db.story.findMany({
      take: 9,
      orderBy: { createdAt: 'desc' },
      include: { genres: { take: 1 } }
    }),
    // Completed Stories (Status = COMPLETED)
    db.story.findMany({
      take: 9,
      where: { status: 'COMPLETED' },
      orderBy: { updatedAt: 'desc' },
      include: { genres: { take: 1 } }
    })
  ]);

  // Reuse hotStories for Top Views ranking (slice 10) or fetch separate if needed. 
  // hotStories is sorted by viewCount, so we can reuse it. 
  const topViews = hotStories.slice(0, 10);

  return (
    <div className="bg-[#fdfdfd] pb-24">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">

        {/* Main Grid: Content (Left) + Sidebar (Right) */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">

          {/* Left Column (8/12) */}
          <div className="lg:col-span-8 space-y-12">

            {/* Recent Reads (Mobile Only) - Moved to Top */}
            <RecentReads />

            {/* Hot Stories Grid */}
            <section>
              <div className="mb-6 flex items-center justify-between border-l-4 border-brand-primary pl-3">
                <h2 className="text-xl font-bold uppercase text-zinc-800 flex items-center gap-2">
                  <Flame className="h-5 w-5 text-red-500" /> Truyện Hot
                </h2>
                <Link href="/xep-hang?tab=hot" className="text-sm font-medium text-zinc-400 hover:text-brand-primary transition-colors">Tất cả</Link>
              </div>

              {hotStories.length === 0 ? (
                <p className="text-zinc-500 text-sm">Chưa có truyện nào.</p>
              ) : (
                <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6">
                  {hotStories.map(story => (
                    <StoryCard
                      key={story.id}
                      title={story.title}
                      category={story.genres[0]?.name}
                      status={story.status}
                      slug={story.slug}
                      coverImage={story.coverImage}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Ranking Board (Replaces Old New Updates location) */}
            <RankingBoard
              topNominations={topNominations}
              topViews={topViews}
              topLikes={topLikes}
              topFollows={topFollows}
            />

            {/* New Stories (Created At) - Hidden on Mobile */}
            <section className="hidden lg:block">
              <div className="mb-6 flex items-center justify-between border-l-4 border-brand-primary pl-3">
                <h2 className="text-xl font-bold uppercase text-zinc-800 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-green-600" /> Truyện Mới
                </h2>
                <Link href="/xep-hang?tab=new" className="text-sm font-medium text-zinc-400 hover:text-brand-primary transition-colors">Xem tất cả</Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {createdStories.map(story => (
                  <div key={story.id} className="flex gap-3 p-2 rounded-lg bg-white border border-zinc-100 hover:shadow-md transition-shadow group">
                    <Link href={`/truyen/${story.slug}`} className="shrink-0 w-[70px] h-[95px] relative rounded overflow-hidden bg-zinc-100">
                      {story.coverImage ? (
                        <img src={story.coverImage} alt={story.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-300">
                          <BookOpen size={20} />
                        </div>
                      )}

                      {/* Status Badge */}
                      {story.status === 'COMPLETED' && (
                        <span className="absolute top-0 right-0 bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 shadow-sm z-10 uppercase tracking-wider">
                          Full
                        </span>
                      )}
                    </Link>
                    <div className="flex flex-col flex-1 min-w-0 py-0.5">
                      <Link href={`/truyen/${story.slug}`} className="font-bold text-sm text-zinc-800 line-clamp-1 group-hover:text-brand-primary transition-colors" title={story.title}>
                        {story.title}
                      </Link>
                      <p className="text-[11px] text-zinc-500 line-clamp-2 mt-1 mb-auto leading-relaxed">
                        {story.description || "Chưa có mô tả..."}
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-zinc-400 mt-2">
                        <span className="flex items-center gap-1 truncate max-w-[50%]">
                          <User size={10} /> {story.author}
                        </span>
                        {story.genres[0] && (
                          <span className="border border-zinc-200 px-1 py-0.5 rounded text-zinc-500 whitespace-nowrap">
                            {story.genres[0].name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Completed Stories (Status = COMPLETED) - Hidden on Mobile */}
            <section className="hidden lg:block">
              <div className="mb-6 flex items-center justify-between border-l-4 border-brand-primary pl-3">
                <h2 className="text-xl font-bold uppercase text-zinc-800 flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-blue-600" /> Truyện Đã Hoàn Thành
                </h2>
                <Link href="/xep-hang?tab=completed" className="text-sm font-medium text-zinc-400 hover:text-brand-primary transition-colors">Xem tất cả</Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {completedStories.map(story => (
                  <div key={story.id} className="flex gap-3 p-2 rounded-lg bg-white border border-zinc-100 hover:shadow-md transition-shadow group">
                    <Link href={`/truyen/${story.slug}`} className="shrink-0 w-[70px] h-[95px] relative rounded overflow-hidden bg-zinc-100">
                      {story.coverImage ? (
                        <img src={story.coverImage} alt={story.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-300">
                          <BookOpen size={20} />
                        </div>
                      )}
                      {/* Status Badge */}
                      <span className="absolute top-0 right-0 bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 shadow-sm z-10 uppercase tracking-wider">
                        Full
                      </span>
                    </Link>
                    <div className="flex flex-col flex-1 min-w-0 py-0.5">
                      <Link href={`/truyen/${story.slug}`} className="font-bold text-sm text-zinc-800 line-clamp-1 group-hover:text-brand-primary transition-colors" title={story.title}>
                        {story.title}
                      </Link>
                      <p className="text-[11px] text-zinc-500 line-clamp-2 mt-1 mb-auto leading-relaxed">
                        {story.description || "Chưa có mô tả..."}
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-zinc-400 mt-2">
                        <span className="flex items-center gap-1 truncate max-w-[50%]">
                          <User size={10} /> {story.author}
                        </span>
                        {story.genres[0] && (
                          <span className="border border-zinc-200 px-1 py-0.5 rounded text-zinc-500 whitespace-nowrap">
                            {story.genres[0].name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

          </div>

          {/* Right Column (Sidebar - 4/12) */}
          <aside className="lg:col-span-4 space-y-12">
            <div className="hidden lg:block">
              <ReadingHistoryWidget />
            </div>

            {/* Genres */}
            <section>
              <div className="mb-6 border-l-4 border-brand-primary pl-3">
                <h2 className="text-xl font-bold uppercase text-zinc-800">Thể Loại</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {GENRES.map((genre) => (
                  <Link key={genre} href={`/tim-kiem?the-loai=${encodeURIComponent(genre)}`} className="rounded bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-200 hover:text-brand-primary transition-all">
                    {genre}
                  </Link>
                ))}
              </div>
            </section>

            {/* New Updates (Moved Here - Hidden on Mobile) */}
            <section className="hidden lg:block">
              <div className="mb-6 flex items-center justify-between border-l-4 border-brand-primary pl-3">
                <h2 className="text-xl font-bold uppercase text-zinc-800 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-yellow-500" /> Mới Cập Nhật
                </h2>
                <Link href="/xep-hang?tab=new" className="text-sm font-medium text-zinc-400 hover:text-brand-primary transition-colors">Xem tất cả</Link>
              </div>

              <div className="rounded-xl border border-zinc-100 bg-white shadow-sm overflow-hidden">
                {newStories.length === 0 ? (
                  <div className="p-4 text-zinc-500 text-sm">Chưa có cập nhật mới.</div>
                ) : (
                  newStories.map((story) => {
                    const latestChapter = story.chapters[0];
                    return (
                      <Link href={`/truyen/${story.slug}`} key={story.id} className="group flex items-center justify-between border-b border-zinc-50 p-3 transition-colors hover:bg-zinc-50 last:border-0">
                        <div className="flex flex-1 items-center gap-3 min-w-0">
                          {/* Small Number/Dot or just Title? Sidebar is narrow. layout simple. */}
                          <div className="flex-1 min-w-0">
                            <h4 className="truncate text-sm font-bold text-zinc-800 group-hover:text-brand-primary transition-colors">
                              {story.title}
                            </h4>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-zinc-400">{story.genres[0]?.name}</span>
                              <span className="text-[10px] text-zinc-300">•</span>
                              <span className="text-[10px] text-zinc-400 truncate max-w-[80px]">{story.author}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-[10px] text-zinc-400 shrink-0 flex flex-col items-end">
                          {latestChapter && <span className="font-medium text-zinc-600">C.{latestChapter.index}</span>}
                          {latestChapter && <span>{formatDistanceToNow(new Date(latestChapter.createdAt), { addSuffix: false, locale: vi }).replace('khoảng ', '')}</span>}
                        </div>
                      </Link>
                    )
                  })
                )}
              </div>
            </section>
          </aside>

        </div>
      </div>
    </div>
  );
}
