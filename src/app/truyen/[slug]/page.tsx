import { BookOpen, User, Clock, Eye, Star, List, ChevronRight, PlayCircle, Heart, Bookmark, Trophy } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import ReviewButton from '@/components/story/ReviewButton';
import StoryInteractions from '@/components/story/StoryInteractions';
import CommentSection from '@/components/story/CommentSection';

import { getStoryBySlug, getChaptersByStoryId, getRelatedStories, getStoriesByAuthor, getTopNominations } from '@/actions/stories';
import db from '@/lib/db';
import { notFound } from 'next/navigation';
import { formatNumber } from '@/lib/utils';

// ✅ Bỏ auth() và getStoryInteractions() hoàn toàn
// → Next.js cache toàn bộ trang, revalidate = 60 hoạt động đúng
// → Phần like/follow/lịch sử đọc: StoryInteractions tự xử lý client-side
export const revalidate = 60;
export const dynamicParams = true;

// ✅ Pre-build top 100 truyện hot nhất lúc deploy
// → Vercel build sẵn HTML tĩnh, user vào là có ngay không cần chờ
// → Các truyện còn lại vẫn hoạt động bình thường (dynamicParams = true)
export async function generateStaticParams() {
    const stories = await db.story.findMany({
        orderBy: { viewCount: 'desc' },
        take: 100,
        select: { slug: true },
    });
    return stories.map(s => ({ slug: s.slug }));
}

const StoryDetail = async ({
    params,
    searchParams
}: {
    params: Promise<{ slug: string }>,
    searchParams: Promise<{ page?: string }>
}) => {
    const { slug } = await params;
    const { page: pageParam } = await searchParams;
    const currentPage = Math.max(1, parseInt(pageParam || '1'));

    // ✅ Tất cả query chạy song song, không có auth() chặn cache
    const [storyData, chapterData, relatedStories, authorStories] = await Promise.all([
        getStoryBySlug(slug),
        // chapters cần storyId nên phải chờ storyData — xử lý sau
        Promise.resolve(null),
        Promise.resolve([]),
        Promise.resolve([]),
    ]);

    if (!storyData) return notFound();

    // ✅ Round 2: các query cần storyId, chạy song song
    const [chapterDataReal, relatedStoriesReal, authorStoriesReal, topNominations] = await Promise.all([
        getChaptersByStoryId(storyData.id, currentPage),
        getRelatedStories(storyData.id, storyData.genres.map(g => g.name), 5),
        getStoriesByAuthor(storyData.author, storyData.id, 4),
        getTopNominations(5),
    ]);

    const story = {
        title: storyData.title,
        coverImage: storyData.coverImage,
        author: storyData.author,
        genres: storyData.genres.map(g => g.name),
        status: storyData.status === 'COMPLETED' ? "Hoàn thành" : storyData.status === 'TRANSLATED' ? "Dịch" : storyData.status === 'CONVERTED' ? "Convert" : "Đang ra",
        chapters: formatNumber(storyData._count.chapters),
        views: formatNumber(storyData.viewCount),
        rating: storyData.ratingScore || 5.0,
        ratingCount: formatNumber(storyData.ratingCount || 0),
        description: storyData.description || "Chưa có giới thiệu.",
        reviews: storyData.reviews || [],
        latestChapters: storyData.chapters.map(c => ({
            id: c.index,
            title: c.title,
            time: new Date(c.updatedAt).toLocaleDateString('vi-VN')
        }))
    };

    const totalPages = chapterDataReal.totalPages;
    const pageUrl = (p: number) => `/truyen/${slug}?page=${p}`;

    return (
        <div className="min-h-screen bg-warm-bg pb-16">

            {/* Breadcrumb */}
            <div className="bg-warm-card border-b border-warm-border mb-7">
                <div className="container mx-auto px-4 py-3 flex items-center gap-2 text-xs text-warm-ink-light">
                    <a href="/" className="text-warm-ink-soft hover:text-warm-primary transition-colors">Mê Truyện Chữ</a>
                    <ChevronRight className="h-3 w-3 text-warm-border" aria-hidden="true" />
                    <span className="font-semibold text-warm-ink-mid truncate">{story.title}</span>
                </div>
            </div>

            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-7">

                    {/* ── MAIN COLUMN ── */}
                    <div className="lg:col-span-9 space-y-6">

                        {/* HERO CARD */}
                        <div className="bg-warm-card rounded-2xl border border-warm-border-soft shadow-md p-6 md:p-8 flex flex-col md:flex-row gap-7">

                            {/* Cover */}
                            <div className="shrink-0 relative self-start mx-auto md:mx-0">
                                {story.coverImage ? (
                                    <div className="w-44 relative rounded-xl overflow-hidden shadow-xl" style={{ aspectRatio: '3/4' }}>
                                        <Image
                                            src={story.coverImage}
                                            alt={`Ảnh bìa truyện ${story.title}`}
                                            fill
                                            sizes="176px"
                                            className="object-cover"
                                            priority={true}
                                        />
                                    </div>
                                ) : (
                                    <div className="w-44 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#f5e6d3] to-[#e8d5bf] shadow-xl"
                                        style={{ aspectRatio: '3/4' }}>
                                        <BookOpen className="h-14 w-14 text-warm-ink-light opacity-20" aria-hidden="true" />
                                    </div>
                                )}
                                {story.status === 'Hoàn thành' && (
                                    <span className="absolute top-2 left-2 bg-warm-primary text-white text-sm font-black px-2.5 py-1 rounded-md uppercase tracking-widest shadow">
                                        FULL
                                    </span>
                                )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0 flex flex-col gap-3">
                                <h1 className="text-xl md:text-2xl font-bold leading-snug text-warm-ink">{story.title}</h1>

                                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-base font-semibold text-warm-ink-soft">
                                    <span className="flex items-center gap-1.5">
                                        <User className="h-3.5 w-3.5 text-warm-primary" aria-hidden="true" />
                                        <Link href={`/tim-kiem?tac-gia=${encodeURIComponent(story.author)}`} className="text-warm-primary hover:underline">{story.author}</Link>
                                    </span>
                                    <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-base font-bold bg-green-50 text-green-700 border border-green-200">
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" aria-hidden="true"></span>
                                        {story.status}
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <Eye className="h-3.5 w-3.5 text-warm-ink-light" aria-hidden="true" />
                                        {story.views} lượt đọc
                                    </span>
                                </div>

                                <div className="flex flex-wrap gap-1.5">
                                    {story.genres.map(g => (
                                        <Link key={g} href={`/tim-kiem?the-loai=${encodeURIComponent(g)}`}
                                            className="px-3 py-0.5 rounded-full text-base font-semibold bg-warm-primary-pale text-warm-primary border border-warm-primary/20 hover:bg-warm-primary hover:text-white transition-all">
                                            {g}
                                        </Link>
                                    ))}
                                </div>

                                <div className="flex items-center gap-2 flex-wrap">
                                    <span role="img" aria-label={`Điểm đánh giá: ${story.rating} trên 5 sao`} className="flex">
                                        {[1, 2, 3, 4, 5].map(i => (
                                            <Star key={i} className={`h-4 w-4 fill-current ${i <= Math.round(story.rating) ? 'text-amber-400' : 'text-zinc-200'}`} aria-hidden="true" />
                                        ))}
                                    </span>
                                    <span className="text-lg font-black text-warm-gold">{story.rating}</span>
                                    <span className="text-sm text-warm-ink-soft">({story.ratingCount} đánh giá)</span>
                                    {/* ✅ ReviewButton không cần currentUser — tự check auth khi click */}
                                    <ReviewButton
                                        storyId={storyData.id}
                                        text="Đánh giá"
                                        currentUser={undefined}
                                        className="flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold bg-warm-primary-pale text-[#8c3a08] border border-warm-primary/50 hover:bg-warm-primary hover:text-white transition-all"
                                    />
                                </div>

                                {/* Stats bar */}
                                <div className="flex rounded-xl overflow-hidden border border-warm-border-soft bg-warm-bg">
                                    <div className="flex-1 flex items-center justify-center gap-2 py-2.5 text-base font-semibold text-warm-ink-mid">
                                        <Heart className="h-3.5 w-3.5 fill-current text-red-500" aria-hidden="true" />
                                        <b className="text-lg font-bold text-warm-ink">{formatNumber(storyData.likeCount || 0)}</b>
                                        <span className="hidden sm:inline">Yêu thích</span>
                                    </div>
                                    <div className="w-px bg-warm-border" aria-hidden="true"></div>
                                    <div className="flex-1 flex items-center justify-center gap-2 py-2.5 text-base font-semibold text-warm-ink-mid">
                                        <Bookmark className="h-3.5 w-3.5 fill-current text-blue-500" aria-hidden="true" />
                                        <b className="text-lg font-bold text-warm-ink">{formatNumber(storyData.followCount || 0)}</b>
                                        <span className="hidden sm:inline">Theo dõi</span>
                                    </div>
                                    <div className="w-px bg-warm-border" aria-hidden="true"></div>
                                    <div className="flex-1 flex items-center justify-center gap-2 py-2.5 text-base font-semibold text-warm-ink-mid">
                                        <Trophy className="h-3.5 w-3.5 fill-current text-amber-400" aria-hidden="true" />
                                        <b className="text-lg font-bold text-warm-ink">{formatNumber(storyData.nominationCount || 0)}</b>
                                        <span className="hidden sm:inline">Đề cử</span>
                                    </div>
                                </div>

                                {/* ✅ StoryInteractions nhận userStatus mặc định (chưa đăng nhập)
                                    Component tự check auth khi user bấm like/follow */}
                                <StoryInteractions
                                    storyId={storyData.id}
                                    storySlug={slug}
                                    firstChapterId={1}
                                    latestChapterId={storyData.totalChapters || 1}
                                    stats={{
                                        likeCount: storyData.likeCount || 0,
                                        followCount: storyData.followCount || 0,
                                        nominationCount: storyData.nominationCount || 0,
                                        viewCount: storyData.viewCount
                                    }}
                                    userStatus={{
                                        isLiked: false,
                                        isFollowed: false,
                                        lastReadChapterId: null,
                                    }}
                                    currentUser={undefined}
                                />

                                {/* Nút Nghe Truyện */}
                                <a href={`/truyen/${slug}/nghe`}
                                    aria-label="Nghe truyện"
                                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl font-bold text-sm border-2 border-[#e8580a] text-[#e8580a] hover:bg-[#e8580a] hover:text-white transition-all">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                        <path d="M3 18v-6a9 9 0 0 1 18 0v6" /><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z" /><path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
                                    </svg>
                                    Nghe Truyện
                                </a>
                            </div>
                        </div>

                        {/* GIỚI THIỆU */}
                        <div className="bg-warm-card rounded-2xl border border-warm-border-soft shadow-sm p-6 md:p-8">
                            <h2 className="font-bold text-base mb-4 text-warm-ink flex items-center gap-2.5">
                                <span className="w-1 h-5 rounded-sm bg-warm-primary shrink-0" aria-hidden="true"></span>
                                GIỚI THIỆU
                            </h2>
                            <p className="text-base text-warm-ink whitespace-pre-line leading-relaxed">{story.description}</p>
                        </div>

                        {/* DANH SÁCH CHƯƠNG */}
                        <div className="bg-warm-card rounded-2xl border border-warm-border-soft shadow-sm p-6 md:p-8">
                            <div className="flex items-center justify-between mb-5 pb-4 border-b border-warm-border-soft">
                                <h2 className="font-bold text-base text-warm-ink flex items-center gap-2.5">
                                    <span className="w-1 h-5 rounded-sm bg-warm-primary shrink-0" aria-hidden="true"></span>
                                    DANH SÁCH CHƯƠNG
                                </h2>
                                <span className="text-sm text-warm-ink-soft font-medium">
                                    Tổng: <b className="text-warm-ink-mid">{story.chapters}</b> chương
                                </span>
                            </div>

                            {/* Mới cập nhật */}
                            <div className="mb-5">
                                <p className="text-sm font-black uppercase tracking-widest mb-2.5 flex items-center gap-1.5 text-warm-ink-soft">
                                    <Clock className="h-3 w-3" aria-hidden="true" /> Mới cập nhật
                                </p>
                                <div className="border-t border-warm-border-soft">
                                    {story.latestChapters.map(ch => (
                                        <a href={`/truyen/${slug}/chuong-${ch.id}`} key={ch.id}
                                            className="flex justify-between items-center py-2.5 border-b border-warm-border-soft group">
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" aria-hidden="true"></span>
                                                <span className="text-base font-medium text-warm-ink group-hover:text-warm-primary transition-colors truncate">{ch.title}</span>
                                            </div>
                                            <span className="text-sm text-warm-ink-soft shrink-0 ml-3">{ch.time}</span>
                                        </a>
                                    ))}
                                </div>
                            </div>

                            {/* Tất cả chương */}
                            <div>
                                <p className="text-sm font-black uppercase tracking-widest mb-3 flex items-center gap-1.5 text-warm-ink-soft">
                                    <List className="h-3 w-3" aria-hidden="true" /> Tất cả chương
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10">
                                    {chapterDataReal.chapters.map(ch => (
                                        <a href={`/truyen/${slug}/chuong-${ch.index}`} key={ch.id}
                                            className="text-base text-warm-ink flex justify-between items-center py-2 border-b border-warm-border-soft group hover:text-warm-primary transition-colors">
                                            <span className="truncate">{ch.title || `Chương ${ch.index}`}</span>
                                            <ChevronRight className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-100 text-warm-primary transition-all" aria-hidden="true" />
                                        </a>
                                    ))}
                                </div>

                                {/* Pagination */}
                                {totalPages > 1 && (
                                    <nav className="mt-6 flex justify-center items-center gap-1.5 flex-wrap" aria-label="Phân trang danh sách chương">
                                        {currentPage > 1 && (
                                            <a href={pageUrl(currentPage - 1)} aria-label="Trang trước"
                                                className="px-3 py-2 rounded-lg text-sm font-bold bg-warm-border-soft text-warm-ink-soft hover:bg-warm-primary-pale hover:text-warm-primary transition-colors">
                                                ‹
                                            </a>
                                        )}
                                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                                            .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
                                            .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                                                if (idx > 0 && (arr[idx - 1] as number) + 1 < p) acc.push('...');
                                                acc.push(p);
                                                return acc;
                                            }, [])
                                            .map((p, idx) =>
                                                p === '...'
                                                    ? <span key={`ellipsis-${idx}`} className="px-2 py-2 text-sm text-warm-ink-soft">...</span>
                                                    : <a key={p} href={pageUrl(p as number)} aria-label={`Trang ${p}`} aria-current={currentPage === p ? 'page' : undefined}
                                                        className={`px-3.5 py-2 rounded-lg text-sm font-bold transition-colors ${currentPage === p ? 'bg-warm-primary text-white' : 'bg-warm-border-soft text-warm-ink-soft hover:bg-warm-primary-pale hover:text-warm-primary'}`}>
                                                        {p}
                                                    </a>
                                            )}
                                        {currentPage < totalPages && (
                                            <a href={pageUrl(currentPage + 1)} aria-label="Trang sau"
                                                className="px-3 py-2 rounded-lg text-sm font-bold bg-warm-border-soft text-warm-ink-soft hover:bg-warm-primary-pale hover:text-warm-primary transition-colors">
                                                ›
                                            </a>
                                        )}
                                    </nav>
                                )}
                            </div>
                        </div>

                        {/* BÌNH LUẬN — không cần currentUser, tự check auth khi submit */}
                        <CommentSection
                            storySlug={slug}
                            currentUser={null}
                        />
                    </div>

                    {/* ── SIDEBAR ── */}
                    <aside className="lg:col-span-3 space-y-5" aria-label="Sidebar">

                        {/* TOP ĐỀ CỬ — data thật từ DB */}
                        <div className="bg-warm-card rounded-2xl border border-warm-border-soft shadow-sm p-5">
                            <h2 className="font-bold text-sm mb-4 text-warm-ink flex items-center gap-2">
                                <span className="w-1 h-4 rounded-sm bg-warm-primary shrink-0" aria-hidden="true"></span>
                                TOP ĐỀ CỬ
                            </h2>
                            <div className="space-y-3">
                                {topNominations.map((s: any, i: number) => (
                                    <a key={s.id} href={`/truyen/${s.slug}`} className="flex gap-2.5 group" aria-label={`${s.title} - ${s.author}`}>
                                        {/* Số thứ hạng thay ảnh bìa */}
                                        <div className={`w-10 h-14 rounded-md shrink-0 flex items-center justify-center font-black text-lg ${
                                            i === 0 ? 'bg-red-500 text-white' :
                                            i === 1 ? 'bg-orange-500 text-white' :
                                            i === 2 ? 'bg-amber-400 text-white' :
                                            'bg-warm-border-soft text-warm-ink-mid'
                                        }`} aria-label={`Hạng ${i + 1}`}>
                                            {i + 1}
                                        </div>
                                        <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
                                            <h3 className="text-base font-bold text-warm-ink-mid group-hover:text-warm-primary transition-colors line-clamp-2 leading-tight">{s.title}</h3>
                                            <p className="text-sm text-warm-ink-soft">{s.author}</p>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                {s.genres[0] && (
                                                    <span className="text-sm px-1.5 py-0.5 bg-warm-primary-pale text-[#8c3a08] rounded-full font-semibold border border-warm-primary/20">{s.genres[0].name}</span>
                                                )}
                                                <span className="text-sm text-warm-ink-soft">{s.nominationCount || 0} đề cử</span>
                                            </div>
                                        </div>
                                    </a>
                                ))}
                            </div>
                        </div>

                        {/* TRUYỆN CÙNG THỂ LOẠI */}
                        {relatedStoriesReal.length > 0 && (
                            <div className="bg-warm-card rounded-2xl border border-warm-border-soft shadow-sm p-5">
                                <h2 className="font-bold text-sm mb-4 text-warm-ink flex items-center gap-2">
                                    <span className="w-1 h-4 rounded-sm bg-warm-primary shrink-0" aria-hidden="true"></span>
                                    CÙNG THỂ LOẠI
                                </h2>
                                <div className="space-y-3">
                                    {relatedStoriesReal.map((s: any) => (
                                        <a key={s.id} href={`/truyen/${s.slug}`} className="flex gap-2.5 group" aria-label={`${s.title} - ${s.author}`}>
                                            <div className="w-10 h-14 rounded-md overflow-hidden shrink-0 shadow-sm relative bg-warm-bg">
                                                {s.coverImage ? (
                                                    <Image src={s.coverImage} alt={`Ảnh bìa ${s.title}`} fill sizes="40px" className="object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <BookOpen className="h-4 w-4 text-warm-ink-light" aria-hidden="true" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
                                                <h3 className="text-base font-bold text-warm-ink-mid group-hover:text-warm-primary transition-colors line-clamp-2 leading-tight">{s.title}</h3>
                                                <p className="text-sm text-warm-ink-soft">{s.author}</p>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    {s.genres.slice(0, 1).map((g: any) => (
                                                        <span key={g.name} className="text-sm px-1.5 py-0.5 bg-warm-primary-pale text-[#8c3a08] rounded-full font-semibold border border-warm-primary/20">{g.name}</span>
                                                    ))}
                                                    <span className="text-sm text-warm-ink-soft">{s._count.chapters} chương</span>
                                                </div>
                                            </div>
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* TRUYỆN KHÁC CỦA TÁC GIẢ */}
                        {authorStoriesReal.length > 0 && (
                            <div className="bg-warm-card rounded-2xl border border-warm-border-soft shadow-sm p-5">
                                <h2 className="font-bold text-sm mb-4 text-warm-ink flex items-center gap-2">
                                    <span className="w-1 h-4 rounded-sm bg-warm-primary shrink-0" aria-hidden="true"></span>
                                    CÙNG TÁC GIẢ
                                </h2>
                                <p className="text-sm text-warm-ink-soft mb-3 font-medium">✍️ {story.author}</p>
                                <div className="space-y-3">
                                    {authorStoriesReal.map((s: any) => (
                                        <a key={s.id} href={`/truyen/${s.slug}`} className="flex gap-2.5 group" aria-label={`${s.title}`}>
                                            <div className="w-10 h-14 rounded-md overflow-hidden shrink-0 shadow-sm relative bg-warm-bg">
                                                {s.coverImage ? (
                                                    <Image src={s.coverImage} alt={`Ảnh bìa ${s.title}`} fill sizes="40px" className="object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <BookOpen className="h-4 w-4 text-warm-ink-light" aria-hidden="true" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
                                                <h3 className="text-base font-bold text-warm-ink-mid group-hover:text-warm-primary transition-colors line-clamp-2 leading-tight">{s.title}</h3>
                                                <p className="text-sm text-warm-ink-soft">{s._count.chapters} chương</p>
                                                <span className={`text-sm w-fit px-1.5 py-0.5 rounded-full font-semibold mt-0.5 ${s.status === 'COMPLETED' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-500'}`}>
                                                    {s.status === 'COMPLETED' ? 'Hoàn thành' : 'Đang ra'}
                                                </span>
                                            </div>
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}

                    </aside>
                </div>
            </div>
        </div>
    );
};

export default StoryDetail;
