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

/** Chuyển Markdown đơn giản → HTML tĩnh (server-side, SEO-friendly).
 *  Hỗ trợ: # H1, ## H2, ### H3, **bold**, *italic*, - list, numbered list, ---.
 */
function markdownToHtml(md: string): string {
    if (!md) return '';
    const lines = md.split('\n');
    const out: string[] = [];
    let inList = false;

    const escHtml = (s: string) =>
        s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const inlineFormat = (s: string) =>
        escHtml(s)
            .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
            .replace(/\*\*(.+?)\*\*/g,     '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g,          '<em>$1</em>');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trim = line.trim();

        if (!trim) {
            if (inList) { out.push('</ul>'); inList = false; }
            continue;
        }
        if (/^---+$/.test(trim)) {
            if (inList) { out.push('</ul>'); inList = false; }
            out.push('<hr>');
            continue;
        }
        if (trim.startsWith('### ')) {
            if (inList) { out.push('</ul>'); inList = false; }
            out.push(`<h3>${inlineFormat(trim.slice(4))}</h3>`);
        } else if (trim.startsWith('## ')) {
            if (inList) { out.push('</ul>'); inList = false; }
            out.push(`<h2>${inlineFormat(trim.slice(3))}</h2>`);
        } else if (trim.startsWith('# ')) {
            if (inList) { out.push('</ul>'); inList = false; }
            out.push(`<h1>${inlineFormat(trim.slice(2))}</h1>`);
        } else if (/^(\*|-|\d+\.) /.test(trim)) {
            if (!inList) { out.push('<ul>'); inList = true; }
            const text = trim.replace(/^(\*|-|\d+\.) /, '');
            out.push(`<li>${inlineFormat(text)}</li>`);
        } else {
            if (inList) { out.push('</ul>'); inList = false; }
            out.push(`<p>${inlineFormat(trim)}</p>`);
        }
    }
    if (inList) out.push('</ul>');
    return out.join('\n');
}

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
        storyType: (storyData as any).storyType as string ?? 'ORIGINAL',
        isCompletedFlag: (storyData as any).isCompleted as boolean ?? false,
        chapters: formatNumber(storyData._count.chapters),
        views: formatNumber(storyData.viewCount),
        rating: storyData.ratingScore ?? 0,
        ratingCount: storyData.ratingCount || 0,
        description: storyData.description || 'Chưa có giới thiệu.',
        aiReview: (storyData as any).aiReview as string | null ?? null,
        reviews: freshReviews.map(review => ({
            ...review,
            user: {
                ...review.user,
                name: review.user.name || 'Khách ẩn danh',
                image: review.user.image || '',
            },
        })),
    };

    return (
        <div className="min-h-screen bg-warm-bg">

            {/* ══════════════════════════════════════════
                HERO — blurred cover banner
            ══════════════════════════════════════════ */}
            <div className="relative overflow-hidden" style={{ minHeight: 340 }}>
                {/* Blurred BG */}
                {story.coverImage && (
                    <div
                        className="absolute inset-0 bg-cover bg-center scale-110"
                        style={{
                            backgroundImage: `url(${story.coverImage})`,
                            filter: 'blur(28px) brightness(0.35)',
                        }}
                    />
                )}
                {/* Gradient vignette */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/40 to-warm-bg" />
                <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-transparent to-transparent" />

                {/* Breadcrumb */}
                <div className="relative z-10 pt-5 pb-2 px-4 sm:px-6 lg:px-8 max-w-screen-xl mx-auto">
                    <div className="flex items-center gap-2 text-[11px] font-medium tracking-wide uppercase text-white/40">
                        <a href="/" className="hover:text-white/70 transition-colors">Trang chủ</a>
                        <ChevronRight className="h-3 w-3" />
                        <span className="text-white/60 truncate max-w-[200px]">{story.title}</span>
                    </div>
                </div>

                {/* Hero content */}
                <div className="relative z-10 px-4 sm:px-6 lg:px-8 max-w-screen-xl mx-auto pb-10 pt-4 flex gap-7 items-end">

                    {/* Cover */}
                    <div className="shrink-0 hidden sm:block">
                        <div className="relative w-44 rounded-2xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.7)]" style={{ aspectRatio: '3/4' }}>
                            {story.coverImage ? (
                                <Image
                                    src={story.coverImage}
                                    alt={story.title}
                                    fill sizes="176px"
                                    className="object-cover"
                                    priority
                                    unoptimized={story.coverImage.startsWith('/covers/')}
                                />
                            ) : (
                                <div className="w-full h-full bg-gradient-to-br from-[#2a1a0e] to-[#0f0d0a] flex items-center justify-center">
                                    <BookOpen className="h-12 w-12 text-white/10" />
                                </div>
                            )}
                            {/* Glow ring */}
                            <div className="absolute inset-0 rounded-2xl ring-1 ring-white/10" />
                        </div>
                    </div>

                    {/* Text info */}
                    <div className="flex-1 min-w-0 pb-1">
                        {/* Badges */}
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black tracking-widest uppercase ${
                                story.isCompleted
                                    ? 'bg-red-500/20 text-red-300 ring-1 ring-red-500/30'
                                    : 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30'
                            }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${story.isCompleted ? 'bg-red-400' : 'bg-emerald-400'}`} />
                                {story.status}
                            </span>
                            {story.storyType === 'CONVERT' && (
                                <span className="px-3 py-1 rounded-full text-[11px] font-black tracking-widest uppercase bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/30">
                                    Convert
                                </span>
                            )}
                            {story.storyType === 'TRANSLATED' && (
                                <span className="px-3 py-1 rounded-full text-[11px] font-black tracking-widest uppercase bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/30">
                                    Dịch
                                </span>
                            )}
                        </div>

                        <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-white leading-tight mb-3 drop-shadow-lg">
                            {story.title}
                        </h1>

                        <div className="flex items-center gap-4 text-[13px] text-white/50 mb-4">
                            <span className="flex items-center gap-1.5">
                                <Eye className="h-3.5 w-3.5" />
                                {story.views} lượt nghe
                            </span>
                            <span className="flex items-center gap-1.5">
                                <BookOpen className="h-3.5 w-3.5" />
                                {story.chapters} chương
                            </span>
                            <span className="text-white/30">✍️ {story.author}</span>
                        </div>

                        {/* Genre tags */}
                        <div className="flex flex-wrap gap-1.5">
                            {story.genres.map(g => (
                                <Link
                                    key={g}
                                    href={`/tim-kiem?the-loai=${encodeURIComponent(g)}`}
                                    className="px-3 py-1 rounded-full text-[11px] font-bold transition-all"
                                    style={{
                                        background: 'rgba(232,88,10,0.15)',
                                        color: '#ff9a5c',
                                        border: '1px solid rgba(232,88,10,0.3)',
                                    }}
                                >
                                    {g}
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* ══════════════════════════════════════════
                MAIN GRID
            ══════════════════════════════════════════ */}
            <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 -mt-2">

                    {/* ── MAIN COLUMN ── */}
                    <div className="lg:col-span-9 space-y-5">

                        {/* ── COVER mobile (chỉ hiện < sm) ── */}
                        <div className="sm:hidden flex justify-center -mt-16 relative z-10">
                            <div className="relative w-36 rounded-2xl overflow-hidden shadow-[0_16px_48px_rgba(0,0,0,0.6)] ring-1 ring-white/10" style={{ aspectRatio: '3/4' }}>
                                {story.coverImage ? (
                                    <Image src={story.coverImage} alt={story.title} fill sizes="144px" className="object-cover" priority unoptimized={story.coverImage.startsWith('/covers/')} />
                                ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-[#2a1a0e] to-[#0f0d0a] flex items-center justify-center">
                                        <BookOpen className="h-10 w-10 text-white/10" />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ── INTERACTIONS + NGHE ── */}
                        <div className="bg-warm-card rounded-2xl p-5 shadow-lg"
                            style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.18)' }}>
                            <StoryRatingClient
                                storyId={storyData.id}
                                currentUser={currentUser}
                                hasReviewed={hasReviewed}
                                initialRating={story.rating}
                                initialRatingCount={story.ratingCount}
                                initialReviews={story.reviews}
                            />
                            <div className="mt-4">
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
                        </div>

                        {/* ── GIỚI THIỆU ── */}
                        <div className="bg-warm-card rounded-2xl p-6 shadow-lg" style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.18)' }}>
                            <h2 className="font-black text-[11px] uppercase tracking-[.14em] mb-4 flex items-center gap-2.5 text-warm-ink-soft">
                                <span className="w-4 h-[2px] rounded-full bg-warm-primary" />
                                Giới thiệu
                            </h2>
                            <p className="text-[15px] text-warm-ink leading-relaxed whitespace-pre-line">
                                {story.description}
                            </p>
                        </div>

                        {/* ── AI REVIEW (SEO) ── chỉ render khi có nội dung */}
                        {story.aiReview && (
                            <div className="bg-warm-card rounded-2xl p-6 shadow-lg" style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.18)' }}>
                                <h2 className="font-black text-[11px] uppercase tracking-[.14em] mb-5 flex items-center gap-2.5 text-warm-ink-soft">
                                    <span className="w-4 h-[2px] rounded-full bg-warm-primary" />
                                    Đánh giá chi tiết
                                </h2>
                                {/* prose-warm: styled article cho Google đọc — toàn bộ render server-side */}
                                <article
                                    className="ai-review-body"
                                    dangerouslySetInnerHTML={{ __html: markdownToHtml(story.aiReview) }}
                                    style={{
                                        color: 'var(--color-warm-ink, #e5ddd0)',
                                        fontSize: '15px',
                                        lineHeight: '1.85',
                                    }}
                                />
                            </div>
                        )}

                        {/* ── BÌNH LUẬN ── */}
                        <div className="bg-warm-card rounded-2xl p-6 shadow-lg" style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.18)' }}>
                            <h2 className="font-black text-[11px] uppercase tracking-[.14em] mb-5 flex items-center gap-2.5 text-warm-ink-soft">
                                <span className="w-4 h-[2px] rounded-full bg-warm-primary" />
                                Bình luận
                            </h2>
                            <CommentSectionWrapper storySlug={slug} />
                        </div>
                    </div>

                    {/* ── SIDEBAR ── */}
                    <aside className="lg:col-span-3 space-y-4" aria-label="Sidebar">

                        {/* TOP ĐỀ CỬ */}
                        <div className="bg-warm-card rounded-2xl p-5" style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.18)' }}>
                            <h2 className="font-black text-[11px] uppercase tracking-[.14em] mb-4 flex items-center gap-2 text-warm-ink-soft">
                                <span className="w-4 h-[2px] rounded-full bg-warm-primary" />
                                🏆 Top đề cử
                            </h2>
                            <div className="space-y-3">
                                {topNominations.map((s: any, i: number) => (
                                    <a key={s.id} href={`/truyen/${s.slug}`}
                                        className="flex gap-3 group items-center py-1">
                                        {/* Rank badge */}
                                        <div className={`w-6 h-6 rounded-lg shrink-0 flex items-center justify-center font-black text-[11px] ${
                                            i === 0 ? 'bg-gradient-to-br from-yellow-400 to-amber-500 text-white shadow-sm' :
                                            i === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-400 text-white shadow-sm' :
                                            i === 2 ? 'bg-gradient-to-br from-orange-400 to-amber-600 text-white shadow-sm' :
                                            'text-warm-ink-soft bg-warm-bg'
                                        }`}>
                                            {i + 1}
                                        </div>
                                        {/* Cover thumbnail */}
                                        {s.coverImage && (
                                            <div className="w-9 h-12 rounded-lg overflow-hidden shrink-0 relative bg-warm-bg shadow-sm">
                                                <Image src={s.coverImage} alt={s.title} fill sizes="36px" className="object-cover" unoptimized={s.coverImage?.startsWith('/covers/')} />
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[12px] font-bold text-warm-ink-mid group-hover:text-warm-primary transition-colors line-clamp-2 leading-snug">
                                                {s.title}
                                            </p>
                                            <p className="text-[11px] text-warm-ink-soft mt-0.5">
                                                🏅 {s.nominationCount || 0} đề cử
                                            </p>
                                        </div>
                                    </a>
                                ))}
                            </div>
                        </div>

                        {/* CÙNG THỂ LOẠI */}
                        {relatedStoriesReal.length > 0 && (
                            <div className="bg-warm-card rounded-2xl p-5" style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.18)' }}>
                                <h2 className="font-black text-[11px] uppercase tracking-[.14em] mb-4 flex items-center gap-2 text-warm-ink-soft">
                                    <span className="w-4 h-[2px] rounded-full bg-warm-primary" />
                                    Cùng thể loại
                                </h2>
                                <div className="space-y-3">
                                    {relatedStoriesReal.map((s: any) => (
                                        <a key={s.id} href={`/truyen/${s.slug}`}
                                            className="flex gap-3 group items-center py-1">
                                            <div className="w-10 h-14 rounded-xl overflow-hidden shrink-0 relative bg-warm-bg shadow-sm">
                                                {s.coverImage ? (
                                                    <Image src={s.coverImage} alt={s.title} fill sizes="40px" className="object-cover" unoptimized={s.coverImage.startsWith('/covers/')} />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <BookOpen className="h-4 w-4 text-warm-ink-light" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[13px] font-bold text-warm-ink-mid group-hover:text-warm-primary transition-colors line-clamp-2 leading-snug">
                                                    {s.title}
                                                </p>
                                                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                                    {s.genres.slice(0, 1).map((g: any) => (
                                                        <span key={g.name} className="text-[10px] px-1.5 py-0.5 rounded-md font-bold"
                                                            style={{ background: 'rgba(232,88,10,0.12)', color: '#e8580a' }}>
                                                            {g.name}
                                                        </span>
                                                    ))}
                                                    <span className="text-[11px] text-warm-ink-soft">{s._count.chapters} chương</span>
                                                </div>
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
