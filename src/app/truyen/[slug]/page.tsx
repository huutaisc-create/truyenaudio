import { BookOpen, Eye, ChevronRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import StoryRatingClient from '@/components/story/StoryRatingClient';
import StoryInteractions from '@/components/story/StoryInteractions';
import CommentSectionWrapper from '@/components/story/CommentSectionWrapper';

import {
    getStoryBySlug,
    getChaptersByStoryId,
    getRelatedStories,
    getStoriesByAuthor,
    getTopNominations,
} from '@/actions/stories';
import db from '@/lib/db';
import { auth } from '@/auth';
import { notFound } from 'next/navigation';
import { formatNumber } from '@/lib/utils';

export const dynamic = 'force-dynamic';


const StoryDetail = async ({
    params,
    searchParams,
}: {
    params: Promise<{ slug: string }>;
    searchParams: Promise<{ page?: string }>;
}) => {
    const { slug } = await params;
    const { page: pageParam } = await searchParams;
    const currentPage = Math.max(1, parseInt(pageParam || '1'));

    // auth() chạy song song với getStoryBySlug — không block cache trang
    const [storyData, session] = await Promise.all([
        getStoryBySlug(slug),
        auth(),
    ]);

    if (!storyData) return notFound();

    const currentUser = session?.user
        ? { id: session.user.id, name: session.user.name ?? '', image: session.user.image ?? null }
        : null;

    // Round 2: tất cả query cần storyId chạy song song
    // reviews fetch thẳng DB (không cache) → luôn fresh, không bị stale 60s
    const [chapterDataReal, relatedStoriesReal, authorStoriesReal, topNominations, freshReviews] =
        await Promise.all([
            getChaptersByStoryId(storyData.id, currentPage),
            getRelatedStories(storyData.id, storyData.genres.map(g => g.name), 5),
            getStoriesByAuthor(storyData.author, storyData.id, 4),
            getTopNominations(5),
            db.review.findMany({
                where: { storyId: storyData.id },
                orderBy: { createdAt: 'desc' },
                take: 10,
                select: {
                    id: true, rating: true, content: true, createdAt: true,
                    user: { select: { name: true, image: true } },
                },
            }),
        ]);

    // Check user đã review truyện này chưa (chỉ khi đã đăng nhập)
    let hasReviewed = false;
    if (currentUser) {
        const existing = await db.review.findFirst({
            where: { userId: currentUser.id, storyId: storyData.id },
            select: { id: true },
        });
        hasReviewed = !!existing;
    }

    const story = {
        title: storyData.title,
        coverImage: storyData.coverImage,
        author: storyData.author,
        genres: storyData.genres.map(g => g.name),
        status: storyData.status === 'COMPLETED' ? 'Hoàn thành' : 'Đang ra',
        storyType: (storyData as any).storyType as string ?? 'ORIGINAL',
        translatorName: (storyData as any).translatorName as string | null ?? null,
        isCompleted: (storyData as any).isCompleted as boolean ?? false,
        chapters: formatNumber(storyData._count.chapters),
        views: formatNumber(storyData.viewCount),
        rating: storyData.ratingScore ?? 0,
        ratingCount: storyData.ratingCount || 0,
        description: storyData.description || 'Chưa có giới thiệu.',
        reviews: freshReviews.map(review => ({
            ...review,
            user: {
                ...review.user,
                name: review.user.name || "Khách ẩn danh",
                image: review.user.image || "",
            },
        })),
        latestChapters: storyData.chapters.map(c => ({
            id: c.index,
            title: c.title,
            time: new Date(c.updatedAt).toLocaleDateString('vi-VN'),
        })),
    };

    const totalPages = chapterDataReal.totalPages;
    const pageUrl = (p: number) => `/truyen/${slug}?page=${p}`;

    return (
        <div className="min-h-screen bg-warm-bg pb-16">

            {/* Breadcrumb */}
            <div className="bg-warm-card border-b border-warm-border mb-7">
                <div className="container mx-auto px-4 py-3 flex items-center gap-2 text-xs text-warm-ink-light">
                    <a href="/" className="text-warm-ink-soft hover:text-warm-primary transition-colors">
                        Truyện Audio Của Tôi
                    </a>
                    <ChevronRight className="h-3 w-3 text-warm-border" aria-hidden="true" />
                    <span className="font-semibold text-warm-ink-mid truncate">{story.title}</span>
                </div>
            </div>

            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-7">

                    {/* ── MAIN COLUMN ── */}
                    <div className="lg:col-span-9 space-y-6">

                        {/* HERO CARD */}
                        <div className="bg-warm-card rounded-2xl shadow-md p-6 md:p-8 flex flex-col md:flex-row gap-7">

                            {/* Cover */}
                            <div className="shrink-0 relative self-start mx-auto md:mx-0">
                                {story.coverImage ? (
                                    <div
                                        className="w-44 relative rounded-xl overflow-hidden shadow-xl"
                                        style={{ aspectRatio: '3/4' }}
                                    >
                                        <Image
                                            src={story.coverImage}
                                            alt={`Ảnh bìa truyện ${story.title}`}
                                            fill
                                            sizes="176px"
                                            className="object-cover"
                                            priority={true}
                                            unoptimized={story.coverImage.startsWith('/covers/')}
                                        />
                                    </div>
                                ) : (
                                    <div
                                        className="w-44 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#f5e6d3] to-[#e8d5bf] shadow-xl"
                                        style={{ aspectRatio: '3/4' }}
                                    >
                                        <BookOpen
                                            className="h-14 w-14 text-warm-ink-light opacity-20"
                                            aria-hidden="true"
                                        />
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
                                <h1 className="text-xl md:text-2xl font-bold leading-snug text-warm-ink">
                                    {story.title}
                                </h1>

                                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-base font-semibold text-warm-ink-soft">
                                    {/* storyType badge */}
                                    {story.storyType === 'CONVERT' && (
                                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                            Convert{story.isCompleted ? ' · Full' : ''}
                                        </span>
                                    )}
                                    {story.storyType === 'TRANSLATED' && (
                                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                            Dịch{story.isCompleted ? ' · Full' : ''}
                                        </span>
                                    )}
                                    <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-base font-bold bg-green-50 text-green-700 border border-green-200">
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" aria-hidden="true" />
                                        {story.status}
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <Eye className="h-3.5 w-3.5 text-warm-ink-light" aria-hidden="true" />
                                        {story.views} lượt đọc
                                    </span>
                                </div>

                                <div className="flex flex-wrap gap-1.5">
                                    {story.genres.map(g => (
                                        <Link
                                            key={g}
                                            href={`/tim-kiem?the-loai=${encodeURIComponent(g)}`}
                                            className="px-3 py-0.5 rounded-full text-base font-semibold bg-warm-primary-pale text-warm-primary border border-warm-primary/20 hover:bg-warm-primary hover:text-white transition-all"
                                        >
                                            {g}
                                        </Link>
                                    ))}
                                </div>

                                {/* ── RATING + REVIEW + DANH SÁCH REVIEW ──
                                    Tách ra Client Component để review hiện ngay sau submit
                                    mà không cần router.refresh() hay đợi revalidate 60s       */}
                                <StoryRatingClient
                                    storyId={storyData.id}
                                    currentUser={currentUser}
                                    hasReviewed={hasReviewed}
                                    initialRating={story.rating}
                                    initialRatingCount={story.ratingCount}
                                    initialReviews={story.reviews}
                                />

                                {/* StoryInteractions */}
                                <StoryInteractions
                                    storyId={storyData.id}
                                    storySlug={slug}
                                    firstChapterId={1}
                                    latestChapterId={storyData.totalChapters || 1}
                                    stats={{
                                        likeCount: storyData.likeCount || 0,
                                        followCount: storyData.followCount || 0,
                                        nominationCount: storyData.nominationCount || 0,
                                        viewCount: storyData.viewCount,
                                    }}
                                    userStatus={{
                                        isLiked: false,
                                        isFollowed: false,
                                        lastReadChapterId: null,
                                    }}
                                    currentUser={currentUser}
                                />

                                {/* Nút Nghe Truyện */}
                                <a
                                    href={`/truyen/${slug}/nghe`}
                                    aria-label="Nghe truyện"
                                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl font-bold text-sm border-2 border-[#e8580a] text-[#e8580a] hover:bg-[#e8580a] hover:text-white transition-all"
                                >
                                    <svg
                                        width="16" height="16" viewBox="0 0 24 24"
                                        fill="none" stroke="currentColor" strokeWidth="2"
                                        strokeLinecap="round" strokeLinejoin="round"
                                        aria-hidden="true"
                                    >
                                        <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
                                        <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z" />
                                        <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
                                    </svg>
                                    Nghe Truyện
                                </a>
                            </div>
                        </div>

                        {/* GIỚI THIỆU */}
                        <div className="bg-warm-card rounded-2xl shadow-sm p-6 md:p-8">
                            <h2 className="font-bold text-base mb-4 text-warm-ink flex items-center gap-2.5">
                                <span className="w-1 h-5 rounded-sm bg-warm-primary shrink-0" aria-hidden="true" />
                                GIỚI THIỆU
                            </h2>
                            <p className="text-base text-warm-ink whitespace-pre-line leading-relaxed">
                                {story.description}
                            </p>
                        </div>

                        {/* BÌNH LUẬN */}
                        <CommentSectionWrapper storySlug={slug} />
                    </div>

                    {/* ── SIDEBAR ── */}
                    <aside className="lg:col-span-3 space-y-5" aria-label="Sidebar">

                        {/* TOP ĐỀ CỬ */}
                        <div className="bg-warm-card rounded-2xl border border-warm-border-soft shadow-sm p-5">
                            <h2 className="font-bold text-sm mb-4 text-warm-ink flex items-center gap-2">
                                <span className="w-1 h-4 rounded-sm bg-warm-primary shrink-0" aria-hidden="true" />
                                TOP ĐỀ CỬ
                            </h2>
                            <div className="space-y-3">
                                {topNominations.map((s: any, i: number) => (
                                    <a
                                        key={s.id}
                                        href={`/truyen/${s.slug}/nghe`}
                                        className="flex gap-2.5 group"
                                        aria-label={`${s.title} - ${s.author}`}
                                    >
                                        <div className={`w-10 h-14 rounded-md shrink-0 flex items-center justify-center font-black text-lg ${
                                            i === 0 ? 'bg-red-500 text-white' :
                                            i === 1 ? 'bg-orange-500 text-white' :
                                            i === 2 ? 'bg-amber-400 text-white' :
                                            'bg-warm-border-soft text-warm-ink-mid'
                                        }`} aria-label={`Hạng ${i + 1}`}>
                                            {i + 1}
                                        </div>
                                        <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
                                            <h3 className="text-base font-bold text-warm-ink-mid group-hover:text-warm-primary transition-colors line-clamp-2 leading-tight">
                                                {s.title}
                                            </h3>

                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                {s.genres[0] && (
                                                    <span className="text-sm px-1.5 py-0.5 bg-warm-primary-pale text-[#8c3a08] rounded-full font-semibold border border-warm-primary/20">
                                                        {s.genres[0].name}
                                                    </span>
                                                )}
                                                <span className="text-sm text-warm-ink-soft">
                                                    {s.nominationCount || 0} đề cử
                                                </span>
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
                                    <span className="w-1 h-4 rounded-sm bg-warm-primary shrink-0" aria-hidden="true" />
                                    CÙNG THỂ LOẠI
                                </h2>
                                <div className="space-y-3">
                                    {relatedStoriesReal.map((s: any) => (
                                        <a
                                            key={s.id}
                                            href={`/truyen/${s.slug}/nghe`}
                                            className="flex gap-2.5 group"
                                            aria-label={`${s.title} - ${s.author}`}
                                        >
                                            <div className="w-10 h-14 rounded-md overflow-hidden shrink-0 shadow-sm relative bg-warm-bg">
                                                {s.coverImage ? (
                                                    <Image src={s.coverImage} alt={`Ảnh bìa ${s.title}`} fill sizes="40px" className="object-cover" unoptimized={s.coverImage.startsWith('/covers/')} />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <BookOpen className="h-4 w-4 text-warm-ink-light" aria-hidden="true" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
                                                <h3 className="text-base font-bold text-warm-ink-mid group-hover:text-warm-primary transition-colors line-clamp-2 leading-tight">
                                                    {s.title}
                                                </h3>

                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    {s.genres.slice(0, 1).map((g: any) => (
                                                        <span key={g.name} className="text-sm px-1.5 py-0.5 bg-warm-primary-pale text-[#8c3a08] rounded-full font-semibold border border-warm-primary/20">
                                                            {g.name}
                                                        </span>
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
                                    <span className="w-1 h-4 rounded-sm bg-warm-primary shrink-0" aria-hidden="true" />
                                    CÙNG TÁC GIẢ
                                </h2>
                                <p className="text-sm text-warm-ink-soft mb-3 font-medium">✍️ {story.author}</p>
                                <div className="space-y-3">
                                    {authorStoriesReal.map((s: any) => (
                                        <a
                                            key={s.id}
                                            href={`/truyen/${s.slug}/nghe`}
                                            className="flex gap-2.5 group"
                                            aria-label={s.title}
                                        >
                                            <div className="w-10 h-14 rounded-md overflow-hidden shrink-0 shadow-sm relative bg-warm-bg">
                                                {s.coverImage ? (
                                                    <Image src={s.coverImage} alt={`Ảnh bìa ${s.title}`} fill sizes="40px" className="object-cover" unoptimized={s.coverImage.startsWith('/covers/')} />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <BookOpen className="h-4 w-4 text-warm-ink-light" aria-hidden="true" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
                                                <h3 className="text-base font-bold text-warm-ink-mid group-hover:text-warm-primary transition-colors line-clamp-2 leading-tight">
                                                    {s.title}
                                                </h3>
                                                <p className="text-sm text-warm-ink-soft">{s._count.chapters} chương</p>
                                                <span className={`text-sm w-fit px-1.5 py-0.5 rounded-full font-semibold mt-0.5 ${
                                                    s.status === 'COMPLETED' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-500'
                                                }`}>
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
