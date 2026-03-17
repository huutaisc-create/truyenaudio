import { BookOpen, User, Clock, Eye, Star, List, ChevronRight, PlayCircle, Heart, Bookmark, Trophy } from 'lucide-react';

import ReviewButton from '@/components/story/ReviewButton';
import StoryInteractions from '@/components/story/StoryInteractions';
import CommentSection from '@/components/story/CommentSection';

import { getStoryBySlug, getChaptersByStoryId, getRelatedStories, getStoriesByAuthor } from '@/actions/stories';
import { getStoryInteractions } from '@/actions/interactions';
import { notFound } from 'next/navigation';

import { auth } from '@/auth';
import { formatNumber } from '@/lib/utils';

const CHAPTERS_PER_PAGE = 20;

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

    const storyData = await getStoryBySlug(slug);
    const session = await auth();

    if (!storyData) return notFound();

    // Fetch all data in parallel
    const [interactionData, chapterData, relatedStories, authorStories] = await Promise.all([
        getStoryInteractions(storyData.id),
        getChaptersByStoryId(storyData.id, currentPage),
        getRelatedStories(storyData.id, storyData.genres.map(g => g.name), 5),
        getStoriesByAuthor(storyData.author, storyData.id, 4),
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

    const totalPages = chapterData.totalPages;
    const pageUrl = (p: number) => `/truyen/${slug}?page=${p}`;

    return (
        <div className="min-h-screen bg-warm-bg pb-16">

            {/* Breadcrumb */}
            <div className="bg-warm-card border-b border-warm-border mb-7">
                <div className="container mx-auto px-4 py-3 flex items-center gap-2 text-xs text-warm-ink-light">
                    <a href="/" className="text-warm-ink-soft hover:text-warm-primary transition-colors">Mê Truyện Chữ</a>
                    <ChevronRight className="h-3 w-3 text-warm-border" />
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
                                    <img src={story.coverImage} alt={story.title}
                                        className="w-44 rounded-xl object-cover shadow-xl"
                                        style={{ aspectRatio: '3/4' }} />
                                ) : (
                                    <div className="w-44 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#f5e6d3] to-[#e8d5bf] shadow-xl"
                                        style={{ aspectRatio: '3/4' }}>
                                        <BookOpen className="h-14 w-14 text-warm-ink-light opacity-20" />
                                    </div>
                                )}
                                {story.status === 'Hoàn thành' && (
                                    <span className="absolute top-2 left-2 bg-warm-primary text-white text-[10px] font-black px-2.5 py-1 rounded-md uppercase tracking-widest shadow">
                                        FULL
                                    </span>
                                )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0 flex flex-col gap-3">
                                <h1 className="text-xl md:text-2xl font-bold leading-snug text-warm-ink">{story.title}</h1>

                                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold text-warm-ink-soft">
                                    <span className="flex items-center gap-1.5">
                                        <User className="h-3.5 w-3.5 text-warm-primary" />
                                        <a href="#" className="text-warm-primary">{story.author}</a>
                                    </span>
                                    <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-green-50 text-green-700 border border-green-200">
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                        {story.status}
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <Eye className="h-3.5 w-3.5 text-warm-ink-light" />
                                        {story.views} lượt đọc
                                    </span>
                                </div>

                                <div className="flex flex-wrap gap-1.5">
                                    {story.genres.map(g => (
                                        <a key={g} href="#"
                                            className="px-3 py-0.5 rounded-full text-[12px] font-semibold bg-warm-primary-pale text-warm-primary border border-warm-primary/20 hover:bg-warm-primary hover:text-white transition-all">
                                            {g}
                                        </a>
                                    ))}
                                </div>

                                <div className="flex items-center gap-2 flex-wrap">
                                    <div className="flex">
                                        {[1, 2, 3, 4, 5].map(i => (
                                            <Star key={i} className={`h-4 w-4 fill-current ${i <= Math.round(story.rating) ? 'text-amber-400' : 'text-zinc-200'}`} />
                                        ))}
                                    </div>
                                    <span className="text-lg font-black text-warm-gold">{story.rating}</span>
                                    <span className="text-xs text-warm-ink-light">({story.ratingCount} đánh giá)</span>
                                    <ReviewButton
                                        storyId={storyData.id}
                                        text="Đánh giá"
                                        currentUser={session?.user}
                                        className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-warm-primary-pale text-warm-primary border border-warm-primary/25 hover:bg-warm-primary hover:text-white transition-all"
                                    />
                                </div>

                                {/* Stats bar */}
                                <div className="flex rounded-xl overflow-hidden border border-warm-border-soft bg-warm-bg">
                                    <div className="flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold text-warm-ink-soft">
                                        <Heart className="h-3.5 w-3.5 fill-current text-red-500" />
                                        <b className="text-warm-ink">{formatNumber(storyData.likeCount || 0)}</b>
                                        <span className="hidden sm:inline">Yêu thích</span>
                                    </div>
                                    <div className="w-px bg-warm-border"></div>
                                    <div className="flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold text-warm-ink-soft">
                                        <Bookmark className="h-3.5 w-3.5 fill-current text-blue-500" />
                                        <b className="text-warm-ink">{formatNumber(storyData.followCount || 0)}</b>
                                        <span className="hidden sm:inline">Theo dõi</span>
                                    </div>
                                    <div className="w-px bg-warm-border"></div>
                                    <div className="flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold text-warm-ink-soft">
                                        <Trophy className="h-3.5 w-3.5 fill-current text-amber-400" />
                                        <b className="text-warm-ink">{formatNumber(storyData.nominationCount || 0)}</b>
                                        <span className="hidden sm:inline">Đề cử</span>
                                    </div>
                                </div>

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
                                    userStatus={interactionData.userStatus}
                                    currentUser={session?.user}
                                />
                                {/* Nút Nghe Truyện */}
                                <a href={`/truyen/${slug}/nghe`}
                                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl font-bold text-sm border-2 border-[#e8580a] text-[#e8580a] hover:bg-[#e8580a] hover:text-white transition-all">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z"/><path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
                                    </svg>
                                    Nghe Truyện
                                </a>
                            </div>
                        </div>

                        {/* GIỚI THIỆU */}
                        <div className="bg-warm-card rounded-2xl border border-warm-border-soft shadow-sm p-6 md:p-8">
                            <h2 className="font-bold text-base mb-4 text-warm-ink flex items-center gap-2.5">
                                <span className="w-1 h-5 rounded-sm bg-warm-primary shrink-0"></span>
                                GIỚI THIỆU
                            </h2>
                            <p className="text-sm text-warm-ink-mid whitespace-pre-line leading-relaxed">{story.description}</p>
                        </div>

                        {/* DANH SÁCH CHƯƠNG */}
                        <div className="bg-warm-card rounded-2xl border border-warm-border-soft shadow-sm p-6 md:p-8">
                            <div className="flex items-center justify-between mb-5 pb-4 border-b border-warm-border-soft">
                                <h2 className="font-bold text-base text-warm-ink flex items-center gap-2.5">
                                    <span className="w-1 h-5 rounded-sm bg-warm-primary shrink-0"></span>
                                    DANH SÁCH CHƯƠNG
                                </h2>
                                <span className="text-xs text-warm-ink-light font-medium">
                                    Tổng: <b className="text-warm-ink-mid">{story.chapters}</b> chương
                                </span>
                            </div>

                            {/* Đang đọc dở */}
                            {interactionData.userStatus.lastReadChapterId && (
                                <div className="mb-5">
                                    <p className="text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-1.5 text-warm-ink-light">
                                        <BookOpen className="h-3 w-3" /> Đang đọc dở
                                    </p>
                                    <a href={`/truyen/${slug}/chuong-${interactionData.userStatus.lastReadChapterId}`}
                                        className="flex items-center gap-3 p-3.5 rounded-xl bg-warm-primary-pale border border-warm-primary/20 hover:border-warm-primary/50 transition-all group">
                                        <div className="w-9 h-9 rounded-lg bg-warm-primary flex items-center justify-center shrink-0 shadow-sm">
                                            <PlayCircle className="h-4 w-4 text-white" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] font-black uppercase tracking-wider mb-0.5 text-warm-primary">Tiếp tục đọc</p>
                                            <p className="text-sm font-bold text-warm-ink truncate group-hover:text-warm-primary transition-colors">
                                                Chương {interactionData.userStatus.lastReadChapterId}
                                            </p>
                                        </div>
                                        <ChevronRight className="h-4 w-4 text-warm-primary shrink-0 group-hover:translate-x-0.5 transition-transform" />
                                    </a>
                                </div>
                            )}

                            {/* Mới cập nhật */}
                            <div className="mb-5">
                                <p className="text-[10px] font-black uppercase tracking-widest mb-2.5 flex items-center gap-1.5 text-warm-ink-light">
                                    <Clock className="h-3 w-3" /> Mới cập nhật
                                </p>
                                <div className="border-t border-warm-border-soft">
                                    {story.latestChapters.map(ch => (
                                        <a href={`/truyen/${slug}/chuong-${ch.id}`} key={ch.id}
                                            className="flex justify-between items-center py-2.5 border-b border-warm-border-soft group">
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0"></span>
                                                <span className="text-sm font-medium text-warm-ink-mid group-hover:text-warm-primary transition-colors truncate">{ch.title}</span>
                                            </div>
                                            <span className="text-xs text-warm-ink-light shrink-0 ml-3">{ch.time}</span>
                                        </a>
                                    ))}
                                </div>
                            </div>

                            {/* Tất cả chương - load thật từ DB */}
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest mb-3 flex items-center gap-1.5 text-warm-ink-light">
                                    <List className="h-3 w-3" /> Tất cả chương
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10">
                                    {chapterData.chapters.map(ch => (
                                        <a href={`/truyen/${slug}/chuong-${ch.index}`} key={ch.id}
                                            className="text-sm text-warm-ink-soft flex justify-between items-center py-2 border-b border-warm-border-soft group hover:text-warm-primary transition-colors">
                                            <span className="truncate">{ch.title || `Chương ${ch.index}`}</span>
                                            <ChevronRight className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-100 text-warm-primary transition-all" />
                                        </a>
                                    ))}
                                </div>

                                {/* Pagination */}
                                {totalPages > 1 && (
                                    <div className="mt-6 flex justify-center items-center gap-1.5 flex-wrap">
                                        {/* Prev */}
                                        {currentPage > 1 && (
                                            <a href={pageUrl(currentPage - 1)}
                                                className="px-3 py-2 rounded-lg text-xs font-bold bg-warm-border-soft text-warm-ink-soft hover:bg-warm-primary-pale hover:text-warm-primary transition-colors">
                                                ‹
                                            </a>
                                        )}

                                        {/* Pages */}
                                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                                            .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
                                            .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                                                if (idx > 0 && (arr[idx - 1] as number) + 1 < p) acc.push('...');
                                                acc.push(p);
                                                return acc;
                                            }, [])
                                            .map((p, idx) =>
                                                p === '...'
                                                    ? <span key={`ellipsis-${idx}`} className="px-2 py-2 text-xs text-warm-ink-light">...</span>
                                                    : <a key={p} href={pageUrl(p as number)}
                                                        className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors ${currentPage === p ? 'bg-warm-primary text-white' : 'bg-warm-border-soft text-warm-ink-soft hover:bg-warm-primary-pale hover:text-warm-primary'}`}>
                                                        {p}
                                                    </a>
                                            )}

                                        {/* Next */}
                                        {currentPage < totalPages && (
                                            <a href={pageUrl(currentPage + 1)}
                                                className="px-3 py-2 rounded-lg text-xs font-bold bg-warm-border-soft text-warm-ink-soft hover:bg-warm-primary-pale hover:text-warm-primary transition-colors">
                                                ›
                                            </a>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>


                        {/* BÌNH LUẬN */}
                        <CommentSection
                            storySlug={slug}
                            currentUser={session?.user ? {
                                id: session.user.id,
                                name: session.user.name || 'User',
                                image: session.user.image,
                            } : null}
                        />

                    </div>

                    {/* ── SIDEBAR ── */}
                    <aside className="lg:col-span-3 space-y-5">

                        {/* TOP ĐỀ CỬ */}
                        <div className="bg-warm-card rounded-2xl border border-warm-border-soft shadow-sm p-5">
                            <h2 className="font-bold text-sm mb-4 text-warm-ink flex items-center gap-2">
                                <span className="w-1 h-4 rounded-sm bg-warm-primary shrink-0"></span>
                                TOP ĐỀ CỬ
                            </h2>
                            <div className="space-y-3">
                                {[1, 2, 3, 4, 5].map(i => (
                                    <div key={i} className="flex items-center gap-2.5 group cursor-pointer">
                                        <span className={`h-6 w-6 rounded-md text-[10px] flex items-center justify-center font-black shrink-0 ${i === 1 ? 'bg-red-500 text-white' : i === 2 ? 'bg-orange-500 text-white' : i === 3 ? 'bg-amber-400 text-white' : 'bg-warm-border-soft text-warm-ink-light'}`}>{i}</span>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-xs font-bold text-warm-ink-mid truncate group-hover:text-warm-primary transition-colors">Truyện hay đề cử số {i}</h4>
                                            <p className="text-[10px] text-warm-ink-light mt-0.5">{1000 - i * 50} đề cử</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* TRUYỆN CÙNG THỂ LOẠI */}
                        {relatedStories.length > 0 && (
                            <div className="bg-warm-card rounded-2xl border border-warm-border-soft shadow-sm p-5">
                                <h2 className="font-bold text-sm mb-4 text-warm-ink flex items-center gap-2">
                                    <span className="w-1 h-4 rounded-sm bg-warm-primary shrink-0"></span>
                                    CÙNG THỂ LOẠI
                                </h2>
                                <div className="space-y-3">
                                    {relatedStories.map((s: any) => (
                                        <a key={s.id} href={`/truyen/${s.slug}`} className="flex gap-2.5 group">
                                            {s.coverImage ? (
                                                <img src={s.coverImage} alt={s.title}
                                                    className="w-10 h-14 rounded-md object-cover shrink-0 shadow-sm" />
                                            ) : (
                                                <div className="w-10 h-14 rounded-md bg-warm-bg flex items-center justify-center shrink-0">
                                                    <BookOpen className="h-4 w-4 text-warm-ink-light" />
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
                                                <h4 className="text-xs font-bold text-warm-ink-mid group-hover:text-warm-primary transition-colors line-clamp-2 leading-tight">{s.title}</h4>
                                                <p className="text-[10px] text-warm-ink-light">{s.author}</p>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    {s.genres.slice(0, 1).map((g: any) => (
                                                        <span key={g.name} className="text-[9px] px-1.5 py-0.5 bg-warm-primary-pale text-warm-primary rounded-full font-semibold">{g.name}</span>
                                                    ))}
                                                    <span className="text-[10px] text-warm-ink-light">{s._count.chapters} chương</span>
                                                </div>
                                            </div>
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* TRUYỆN KHÁC CỦA TÁC GIẢ */}
                        {authorStories.length > 0 && (
                            <div className="bg-warm-card rounded-2xl border border-warm-border-soft shadow-sm p-5">
                                <h2 className="font-bold text-sm mb-4 text-warm-ink flex items-center gap-2">
                                    <span className="w-1 h-4 rounded-sm bg-warm-primary shrink-0"></span>
                                    CÙNG TÁC GIẢ
                                </h2>
                                <p className="text-[10px] text-warm-ink-light mb-3 font-medium">✍️ {story.author}</p>
                                <div className="space-y-3">
                                    {authorStories.map((s: any) => (
                                        <a key={s.id} href={`/truyen/${s.slug}`} className="flex gap-2.5 group">
                                            {s.coverImage ? (
                                                <img src={s.coverImage} alt={s.title}
                                                    className="w-10 h-14 rounded-md object-cover shrink-0 shadow-sm" />
                                            ) : (
                                                <div className="w-10 h-14 rounded-md bg-warm-bg flex items-center justify-center shrink-0">
                                                    <BookOpen className="h-4 w-4 text-warm-ink-light" />
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
                                                <h4 className="text-xs font-bold text-warm-ink-mid group-hover:text-warm-primary transition-colors line-clamp-2 leading-tight">{s.title}</h4>
                                                <p className="text-[10px] text-warm-ink-light">{s._count.chapters} chương</p>
                                                <span className={`text-[9px] w-fit px-1.5 py-0.5 rounded-full font-semibold mt-0.5 ${s.status === 'COMPLETED' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-500'}`}>
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
