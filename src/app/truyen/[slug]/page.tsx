import { BookOpen, Star, MessageSquare, Download, ChevronLeft, Share2, Headphones, List, Clock, ChevronRight, Bookmark } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import StoryRatingClient from '@/components/story/StoryRatingClient';
import StoryInteractions from '@/components/story/StoryInteractions';
import CommentSectionWrapper from '@/components/story/CommentSectionWrapper';
import DescriptionExpand from '@/components/story/DescriptionExpand';

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

    const [storyData, session] = await Promise.all([
        getStoryBySlug(slug),
        auth(),
    ]);

    if (!storyData) return notFound();

    const currentUser = session?.user
        ? { id: session.user.id, name: session.user.name ?? '', image: session.user.image ?? null }
        : null;

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
        isCompleted: storyData.status === 'COMPLETED',
        chapters: formatNumber(storyData._count.chapters),
        chaptersRaw: storyData._count.chapters,
        views: formatNumber(storyData.viewCount),
        likeCount: storyData.likeCount || 0,
        followCount: storyData.followCount || 0,
        rating: storyData.ratingScore ?? 0,
        ratingCount: storyData.ratingCount || 0,
        description: storyData.description || 'Chưa có giới thiệu.',
        reviews: freshReviews.map(review => ({
            ...review,
            user: {
                ...review.user,
                name: review.user.name || 'Khách ẩn danh',
                image: review.user.image || '',
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
        <div className="min-h-screen bg-[#0f0d0a] pb-24">

            {/* ── HERO ── */}
            <div className="relative w-full overflow-hidden" style={{ minHeight: 320 }}>
                {/* Blurred background */}
                {story.coverImage && (
                    <div
                        className="absolute inset-0 bg-cover bg-center scale-110 blur-xl opacity-40"
                        style={{ backgroundImage: `url(${story.coverImage})` }}
                    />
                )}
                <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-[#0f0d0a]/60 to-[#0f0d0a]" />

                {/* Top bar */}
                <div className="relative z-10 flex items-center justify-between px-4 pt-12 pb-2">
                    <Link href="/"
                        className="w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white">
                        <ChevronLeft size={20} />
                    </Link>
                    <button className="w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white">
                        <Share2 size={16} />
                    </button>
                </div>

                {/* Cover + Info */}
                <div className="relative z-10 px-4 pb-6 flex gap-4 items-end mt-2">
                    {/* Text info */}
                    <div className="flex-1 min-w-0">
                        <span className={`inline-block px-2.5 py-1 rounded text-[11px] font-black tracking-widest uppercase mb-2 ${story.isCompleted ? 'bg-red-600 text-white' : 'bg-[#e8580a] text-white'}`}>
                            {story.isCompleted ? 'Hoàn Thành' : 'Đang Ra'}
                        </span>
                        <h1 className="text-[22px] font-bold text-white leading-tight mb-1.5">
                            {story.title}
                        </h1>
                        <div className="flex items-center gap-1.5 text-[#c0b4a8]">
                            <BookOpen size={13} />
                            <span className="text-[13px] font-medium">{story.chapters} Chương</span>
                        </div>
                    </div>

                    {/* Cover image */}
                    {story.coverImage ? (
                        <div className="shrink-0 w-28 rounded-xl overflow-hidden shadow-2xl border border-white/10" style={{ aspectRatio: '3/4' }}>
                            <Image
                                src={story.coverImage}
                                alt={story.title}
                                width={112}
                                height={150}
                                className="object-cover w-full h-full"
                                priority
                                unoptimized={story.coverImage.startsWith('/covers/')}
                            />
                        </div>
                    ) : (
                        <div className="shrink-0 w-28 rounded-xl bg-[#1a1612] border border-white/10 flex items-center justify-center" style={{ aspectRatio: '3/4' }}>
                            <BookOpen size={32} className="text-white/20" />
                        </div>
                    )}
                </div>
            </div>

            {/* ── STATS ── */}
            <div className="mx-4 rounded-2xl overflow-hidden border border-white/[0.07] bg-[#1a1612] mt-1">
                <div className="grid grid-cols-3 divide-x divide-white/[0.07]">
                    <div className="flex flex-col items-center py-3">
                        <span className="text-[18px] font-bold text-white">{story.views}</span>
                        <span className="text-[11px] text-[#8a7e72] mt-0.5">Lượt nghe</span>
                    </div>
                    <div className="flex flex-col items-center py-3">
                        <span className="text-[18px] font-bold text-white">{formatNumber(story.likeCount)}</span>
                        <span className="text-[11px] text-[#8a7e72] mt-0.5">Yêu thích</span>
                    </div>
                    <div className="flex flex-col items-center py-3">
                        <span className="text-[18px] font-bold text-white">{formatNumber(story.followCount)}</span>
                        <span className="text-[11px] text-[#8a7e72] mt-0.5">Theo dõi</span>
                    </div>
                </div>
            </div>

            {/* ── GENRES ── */}
            <div className="px-4 mt-4 flex flex-wrap gap-2">
                {story.genres.map(g => (
                    <Link
                        key={g}
                        href={`/tim-kiem?the-loai=${encodeURIComponent(g)}`}
                        className="px-3.5 py-1.5 rounded-full text-[13px] font-semibold border border-[#e8580a]/50 text-[#e8580a] bg-[#e8580a]/10"
                    >
                        {g}
                    </Link>
                ))}
            </div>

            {/* ── DESCRIPTION ── */}
            <div className="px-4 mt-4">
                <DescriptionExpand text={story.description} />
            </div>

            {/* ── ACTION BUTTONS ── */}
            <div id="actions" className="px-4 mt-5 grid grid-cols-3 gap-3">
                <a href="#danh-gia"
                    className="flex flex-col items-center justify-center gap-1.5 py-4 rounded-2xl bg-[#1a1612] border border-white/[0.07]">
                    <Star size={20} className="text-[#e8580a]" />
                    <span className="text-[12px] font-semibold text-[#d4ccc4]">Đánh Giá</span>
                </a>
                <a href="#binh-luan"
                    className="flex flex-col items-center justify-center gap-1.5 py-4 rounded-2xl bg-[#1a1612] border border-white/[0.07]">
                    <MessageSquare size={20} className="text-[#e8580a]" />
                    <span className="text-[12px] font-semibold text-[#d4ccc4]">Bình Luận</span>
                </a>
                <a href={`/truyen/${slug}/nghe`}
                    className="flex flex-col items-center justify-center gap-1.5 py-4 rounded-2xl bg-[#1a1612] border border-white/[0.07]">
                    <Download size={20} className="text-[#e8580a]" />
                    <span className="text-[12px] font-semibold text-[#d4ccc4]">Tải về</span>
                </a>
            </div>

            {/* ── RELATED STORIES BUTTON ── */}
            {relatedStoriesReal.length > 0 && (
                <div className="px-4 mt-3">
                    <a href="#truyen-lien-quan"
                        className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-[#1a1612] border border-white/[0.07] text-[14px] font-semibold text-[#d4ccc4]">
                        <span className="text-[#e8580a]">✦</span> Truyện liên quan
                    </a>
                </div>
            )}

            {/* ── DANH SÁCH CHƯƠNG ── */}
            <div className="px-4 mt-6">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-[15px] font-bold text-white flex items-center gap-2">
                        <List size={15} className="text-[#e8580a]" /> Danh sách chương
                    </h2>
                    <span className="text-[12px] text-[#8a7e72]">{story.chapters} chương</span>
                </div>

                {/* Mới cập nhật */}
                <div className="mb-3">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-[#8a7e72] mb-2 flex items-center gap-1.5">
                        <Clock size={11} /> Mới cập nhật
                    </p>
                    <div className="rounded-2xl overflow-hidden border border-white/[0.07] bg-[#1a1612]">
                        {story.latestChapters.map((ch, idx) => (
                            <a
                                key={ch.id}
                                href={`/truyen/${slug}/nghe?chuong=${ch.id}`}
                                className={`flex justify-between items-center px-4 py-3 group ${idx < story.latestChapters.length - 1 ? 'border-b border-white/[0.05]' : ''}`}
                            >
                                <span className="text-[13px] font-medium text-[#d4ccc4] group-hover:text-[#e8580a] transition-colors truncate">
                                    {ch.title}
                                </span>
                                <span className="text-[11px] text-[#8a7e72] shrink-0 ml-3">{ch.time}</span>
                            </a>
                        ))}
                    </div>
                </div>

                {/* Tất cả chương */}
                <div className="rounded-2xl overflow-hidden border border-white/[0.07] bg-[#1a1612]">
                    {chapterDataReal.chapters.map((ch, idx) => (
                        <a
                            key={ch.id}
                            href={`/truyen/${slug}/nghe?chuong=${ch.index}`}
                            className={`flex justify-between items-center px-4 py-3 group ${idx < chapterDataReal.chapters.length - 1 ? 'border-b border-white/[0.05]' : ''}`}
                        >
                            <span className="text-[13px] font-medium text-[#d4ccc4] group-hover:text-[#e8580a] transition-colors truncate">
                                {ch.title || `Chương ${ch.index}`}
                            </span>
                            <ChevronRight size={14} className="text-[#8a7e72] shrink-0 opacity-0 group-hover:opacity-100 transition-all" />
                        </a>
                    ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <nav className="mt-4 flex justify-center items-center gap-1.5 flex-wrap">
                        {currentPage > 1 && (
                            <a href={pageUrl(currentPage - 1)}
                                className="px-3 py-2 rounded-lg text-[13px] font-bold bg-[#1a1612] border border-white/[0.07] text-[#d4ccc4]">‹</a>
                        )}
                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                            .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
                            .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                                if (idx > 0 && (arr[idx - 1] as number) + 1 < p) acc.push('...');
                                acc.push(p);
                                return acc;
                            }, [])
                            .map((p, idx) =>
                                p === '...' ? (
                                    <span key={`ellipsis-${idx}`} className="px-2 py-2 text-[13px] text-[#8a7e72]">...</span>
                                ) : (
                                    <a key={p} href={pageUrl(p as number)}
                                        className={`px-3.5 py-2 rounded-lg text-[13px] font-bold transition-colors ${currentPage === p
                                            ? 'bg-[#e8580a] text-white'
                                            : 'bg-[#1a1612] border border-white/[0.07] text-[#d4ccc4]'}`}>
                                        {p}
                                    </a>
                                )
                            )}
                        {currentPage < totalPages && (
                            <a href={pageUrl(currentPage + 1)}
                                className="px-3 py-2 rounded-lg text-[13px] font-bold bg-[#1a1612] border border-white/[0.07] text-[#d4ccc4]">›</a>
                        )}
                    </nav>
                )}
            </div>

            {/* ── ĐÁNH GIÁ ── */}
            <div id="danh-gia" className="px-4 mt-6">
                <h2 className="text-[15px] font-bold text-white flex items-center gap-2 mb-3">
                    <Star size={15} className="text-[#e8580a]" /> Đánh giá
                </h2>
                <div className="rounded-2xl overflow-hidden border border-white/[0.07] bg-[#1a1612] p-4">
                    <StoryRatingClient
                        storyId={storyData.id}
                        currentUser={currentUser}
                        hasReviewed={hasReviewed}
                        initialRating={story.rating}
                        initialRatingCount={story.ratingCount}
                        initialReviews={story.reviews}
                    />
                </div>
            </div>

            {/* ── TƯƠNG TÁC (like/follow) ── */}
            <div className="px-4 mt-4">
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
            </div>

            {/* ── BÌNH LUẬN ── */}
            <div id="binh-luan" className="px-4 mt-6">
                <h2 className="text-[15px] font-bold text-white flex items-center gap-2 mb-3">
                    <MessageSquare size={15} className="text-[#e8580a]" /> Bình luận
                </h2>
                <CommentSectionWrapper storySlug={slug} />
            </div>

            {/* ── TRUYỆN LIÊN QUAN ── */}
            {relatedStoriesReal.length > 0 && (
                <div id="truyen-lien-quan" className="px-4 mt-6">
                    <h2 className="text-[15px] font-bold text-white flex items-center gap-2 mb-3">
                        <span className="text-[#e8580a]">✦</span> Truyện liên quan
                    </h2>
                    <div className="space-y-2">
                        {relatedStoriesReal.map((s: any) => (
                            <a key={s.id} href={`/truyen/${s.slug}/nghe`}
                                className="flex gap-3 items-center p-3 rounded-2xl bg-[#1a1612] border border-white/[0.07] group">
                                <div className="w-12 h-16 rounded-lg overflow-hidden shrink-0 relative bg-[#0f0d0a]">
                                    {s.coverImage ? (
                                        <Image src={s.coverImage} alt={s.title} fill sizes="48px" className="object-cover" unoptimized={s.coverImage.startsWith('/covers/')} />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <BookOpen size={16} className="text-white/20" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-[13px] font-bold text-[#d4ccc4] group-hover:text-[#e8580a] transition-colors line-clamp-2 leading-tight">
                                        {s.title}
                                    </h3>
                                    <div className="flex items-center gap-2 mt-1.5">
                                        {s.genres[0] && (
                                            <span className="text-[11px] px-2 py-0.5 rounded-full border border-[#e8580a]/40 text-[#e8580a] bg-[#e8580a]/10">
                                                {s.genres[0].name}
                                            </span>
                                        )}
                                        <span className="text-[11px] text-[#8a7e72]">{s._count.chapters} chương</span>
                                    </div>
                                </div>
                                <ChevronRight size={15} className="text-[#8a7e72] shrink-0" />
                            </a>
                        ))}
                    </div>
                </div>
            )}

            {/* ── CÙNG TÁC GIẢ ── */}
            {authorStoriesReal.length > 0 && (
                <div className="px-4 mt-6">
                    <h2 className="text-[15px] font-bold text-white flex items-center gap-2 mb-1">
                        <span className="text-[#e8580a]">✍️</span> Cùng tác giả
                    </h2>
                    <p className="text-[12px] text-[#8a7e72] mb-3">{story.author}</p>
                    <div className="space-y-2">
                        {authorStoriesReal.map((s: any) => (
                            <a key={s.id} href={`/truyen/${s.slug}/nghe`}
                                className="flex gap-3 items-center p-3 rounded-2xl bg-[#1a1612] border border-white/[0.07] group">
                                <div className="w-12 h-16 rounded-lg overflow-hidden shrink-0 relative bg-[#0f0d0a]">
                                    {s.coverImage ? (
                                        <Image src={s.coverImage} alt={s.title} fill sizes="48px" className="object-cover" unoptimized={s.coverImage.startsWith('/covers/')} />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <BookOpen size={16} className="text-white/20" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-[13px] font-bold text-[#d4ccc4] group-hover:text-[#e8580a] transition-colors line-clamp-2 leading-tight">
                                        {s.title}
                                    </h3>
                                    <div className="flex items-center gap-2 mt-1.5">
                                        <span className="text-[11px] text-[#8a7e72]">{s._count.chapters} chương</span>
                                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${s.status === 'COMPLETED' ? 'text-green-400 bg-green-900/30' : 'text-blue-400 bg-blue-900/30'}`}>
                                            {s.status === 'COMPLETED' ? 'Hoàn thành' : 'Đang ra'}
                                        </span>
                                    </div>
                                </div>
                                <ChevronRight size={15} className="text-[#8a7e72] shrink-0" />
                            </a>
                        ))}
                    </div>
                </div>
            )}

            {/* ── FIXED BOTTOM BAR ── */}
            <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center gap-3 px-4 py-3 bg-[#0f0d0a]/95 backdrop-blur-md border-t border-white/[0.07]">
                {/* Bookmark */}
                <button className="w-12 h-12 shrink-0 flex items-center justify-center rounded-xl bg-[#1a1612] border border-white/[0.10] text-[#d4ccc4]">
                    <Bookmark size={20} />
                </button>
                {/* Nghe ngay */}
                <a href={`/truyen/${slug}/nghe`}
                    className="flex-1 h-12 flex items-center justify-center gap-2 rounded-xl bg-[#e8580a] text-white font-bold text-[15px] shadow-[0_4px_20px_rgba(232,88,10,0.4)]">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <polygon points="5,3 19,12 5,21" />
                    </svg>
                    Nghe ngay
                </a>
            </div>
        </div>
    );
};

export default StoryDetail;
