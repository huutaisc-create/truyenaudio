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
                        <div style={{
                            background: 'linear-gradient(135deg,#261b10 0%,#1c1208 100%)',
                            borderRadius: '1.25rem',
                            border: '1px solid rgba(232,88,10,0.2)',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.35),inset 0 1px 0 rgba(255,255,255,0.04)',
                            padding: '1.25rem',
                        }}>
                            <StoryRatingClient
                                storyId={storyData.id}
                                currentUser={currentUser}
                                hasReviewed={hasReviewed}
                                initialRating={story.rating}
                                initialRatingCount={story.ratingCount}
                                initialReviews={story.reviews}
                                showReviewList={false}
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
                            {story.reviews.length > 0 && (
                                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '8px' }}>
                                        {story.reviews.map((r, i) => (
                                            <div key={r.id ?? `review-${i}`} style={{ display: 'flex', gap: '10px', padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' as const }}>
                                                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#d4c4b0' }}>{r.user.name}</span>
                                                        <span style={{ display: 'flex', gap: '2px' }}>
                                                            {[1,2,3,4,5].map(s => (
                                                                <span key={s} style={{ color: s <= r.rating ? '#F5A623' : '#3a3020', fontSize: '12px' }}>&#9733;</span>
                                                            ))}
                                                        </span>
                                                    </div>
                                                    {r.content && (
                                                        <p style={{ fontSize: '13px', color: '#8B7355', lineHeight: '1.6', margin: 0 }}>{r.content}</p>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ── GIỚI THIỆU ── */}
                        <div style={{ background: 'linear-gradient(135deg,#231a0e 0%,#181008 100%)', borderRadius: '1.25rem', border: '1px solid rgba(232,88,10,0.14)', boxShadow: '0 8px 32px rgba(0,0,0,0.35)', overflow: 'hidden', position: 'relative' }}>
                            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px', background: 'linear-gradient(180deg,#E8580A,#F5A623 50%,transparent)' }} />
                            <div style={{ position: 'absolute', top: 0, left: 0, width: '200px', height: '120px', background: 'radial-gradient(ellipse at top left,rgba(232,88,10,0.08) 0%,transparent 70%)', pointerEvents: 'none' }} />
                            <div style={{ padding: '1.5rem 1.5rem 1.5rem 1.75rem' }}>
                                <div style={{ marginBottom: '1rem' }}>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 14px', borderRadius: '99px', background: 'linear-gradient(90deg,rgba(232,88,10,0.18),rgba(245,166,35,0.12))', border: '1px solid rgba(232,88,10,0.3)', fontSize: '11px', fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: '#E8580A' }}>
                                        <BookOpen style={{ width: '12px', height: '12px' }} />
                                        Gioi thieu
                                    </span>
                                </div>
                                <p style={{ fontSize: '15px', color: '#e8ddd0', lineHeight: '1.9', whiteSpace: 'pre-line', position: 'relative', zIndex: 1, margin: 0 }}>
                                    {story.description}
                                </p>
                            </div>
                        </div>

                        {/* ── AI REVIEW (SEO) ── chỉ render khi có nội dung */}
                        {story.aiReview && (
                            <div style={{ background: 'linear-gradient(160deg,#1e1a0c 0%,#17120a 60%,#110e08 100%)', borderRadius: '1.25rem', border: '1px solid rgba(245,166,35,0.18)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)', overflow: 'hidden', position: 'relative' }}>
                                <div style={{ height: '2px', background: 'linear-gradient(90deg,transparent,#E8580A 20%,#F5A623 50%,#E8580A 80%,transparent)' }} />
                                <div style={{ position: 'absolute', top: 0, right: 0, width: '300px', height: '200px', background: 'radial-gradient(ellipse at top right,rgba(245,166,35,0.06) 0%,transparent 70%)', pointerEvents: 'none' }} />
                                <div style={{ padding: '1.5rem', position: 'relative', zIndex: 1 }}>
                                    <div style={{ marginBottom: '1.25rem' }}>
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 14px', borderRadius: '99px', background: 'linear-gradient(90deg,rgba(232,88,10,0.2),rgba(245,166,35,0.15))', border: '1px solid rgba(245,166,35,0.28)', fontSize: '11px', fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#F5A623' }}>
                                            Danh gia chi tiet
                                        </span>
                                    </div>
                                    <article
                                        className="ai-review-body"
                                        dangerouslySetInnerHTML={{ __html: markdownToHtml(story.aiReview) }}
                                        style={{ color: 'var(--text,#e5ddd0)', fontSize: '15px', lineHeight: '1.85' }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* ── BÌNH LUẬN ── */}
                        <div style={{ background: 'linear-gradient(135deg,#1e1510 0%,#161008 100%)', borderRadius: '1.25rem', border: '1px solid rgba(255,255,255,0.07)', boxShadow: '0 8px 32px rgba(0,0,0,0.3)', overflow: 'hidden', position: 'relative' }}>
                            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px', background: 'linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0.03))' }} />
                            <div style={{ padding: '1.5rem 1.5rem 1.5rem 1.75rem' }}>
                                <div style={{ marginBottom: '1.25rem' }}>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 14px', borderRadius: '99px', background: 'linear-gradient(90deg,rgba(232,88,10,0.18),rgba(245,166,35,0.12))', border: '1px solid rgba(232,88,10,0.3)', fontSize: '11px', fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: '#E8580A' }}>
                                        <Eye style={{ width: '12px', height: '12px' }} />
                                        Binh luan
                                    </span>
                                </div>
                                <CommentSectionWrapper storySlug={slug} />
                            </div>
                        </div>
                    </div>

                    {/* ── SIDEBAR ── */}
                    <aside className="lg:col-span-3 space-y-4" aria-label="Sidebar">

                        {/* TOP ĐỀ CỬ */}
                        <div style={{ background: 'linear-gradient(160deg,#1f1a0a 0%,#161008 100%)', borderRadius: '1.25rem', border: '1px solid rgba(245,166,35,0.2)', boxShadow: '0 8px 32px rgba(0,0,0,0.35)', overflow: 'hidden' }}>
                            <div style={{ height: '2px', background: 'linear-gradient(90deg,#F5A623,rgba(245,166,35,0.15) 80%,transparent)' }} />
                            <div style={{ padding: '1rem 1.1rem' }}>
                                <div style={{ marginBottom: '0.875rem' }}>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 14px', borderRadius: '99px', background: 'linear-gradient(90deg,rgba(232,88,10,0.2),rgba(245,166,35,0.15))', border: '1px solid rgba(245,166,35,0.28)', fontSize: '11px', fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: '#F5A623' }}>
                                        Top de cu
                                    </span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '2px' }}>
                                    {topNominations.map((s: any, i: number) => {
                                        const badgeStyle = i === 0
                                            ? { background: 'linear-gradient(135deg,#FFD700,#F5A623)', color: '#3d1f00' }
                                            : i === 1
                                            ? { background: 'linear-gradient(135deg,#C0C8D4,#8fa0b0)', color: '#1a2530' }
                                            : i === 2
                                            ? { background: 'linear-gradient(135deg,#CD7F32,#A0522D)', color: '#2a1000' }
                                            : { background: 'rgba(255,255,255,0.06)', color: '#6b5744' };
                                        return (
                                            <a key={s.id} href={`/truyen/${s.slug}`} className="group" style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '8px', borderRadius: '10px', textDecoration: 'none' }}>
                                                <div style={{ width: '24px', height: '24px', borderRadius: '7px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '11px', ...badgeStyle }}>
                                                    {i + 1}
                                                </div>
                                                {s.coverImage && (
                                                    <div style={{ width: '36px', height: '48px', borderRadius: '7px', overflow: 'hidden', flexShrink: 0, position: 'relative' }}>
                                                        <Image src={s.coverImage} alt={s.title} fill sizes="36px" className="object-cover" unoptimized={s.coverImage?.startsWith('/covers/')} />
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[12px] font-bold line-clamp-2 leading-snug group-hover:text-accent transition-colors" style={{ color: '#d4c4b0' }}>
                                                        {s.title}
                                                    </p>
                                                    <p style={{ fontSize: '11px', color: '#c8963a', margin: '3px 0 0' }}>
                                                        {s.nominationCount || 0} de cu
                                                    </p>
                                                </div>
                                            </a>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* CÙNG THỂ LOẠI */}
                        {relatedStoriesReal.length > 0 && (
                            <div style={{ background: 'linear-gradient(160deg,#1c1610 0%,#161008 100%)', borderRadius: '1.25rem', border: '1px solid rgba(232,88,10,0.14)', boxShadow: '0 8px 32px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
                                <div style={{ height: '2px', background: 'linear-gradient(90deg,#E8580A,rgba(232,88,10,0.12) 80%,transparent)' }} />
                                <div style={{ padding: '1rem 1.1rem' }}>
                                    <div style={{ marginBottom: '0.875rem' }}>
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 14px', borderRadius: '99px', background: 'linear-gradient(90deg,rgba(232,88,10,0.18),rgba(245,166,35,0.12))', border: '1px solid rgba(232,88,10,0.3)', fontSize: '11px', fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: '#E8580A' }}>
                                            Cung the loai
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '2px' }}>
                                        {relatedStoriesReal.map((s: any) => (
                                            <a key={s.id} href={`/truyen/${s.slug}`} className="group" style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '8px', borderRadius: '10px', textDecoration: 'none' }}>
                                                <div style={{ width: '40px', height: '54px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0, position: 'relative', background: '#1a1208' }}>
                                                    {s.coverImage ? (
                                                        <Image src={s.coverImage} alt={s.title} fill sizes="40px" className="object-cover" unoptimized={s.coverImage.startsWith('/covers/')} />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center">
                                                            <BookOpen className="h-4 w-4" style={{ color: '#4a3526' }} />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[13px] font-bold line-clamp-2 leading-snug group-hover:text-accent transition-colors" style={{ color: '#d0c0aa', marginBottom: '5px' }}>
                                                        {s.title}
                                                    </p>
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        {s.genres.slice(0, 1).map((g: any) => (
                                                            <span key={g.name} style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '5px', fontWeight: 700, background: 'rgba(232,88,10,0.12)', color: '#e8580a', border: '1px solid rgba(232,88,10,0.2)' }}>
                                                                {g.name}
                                                            </span>
                                                        ))}
                                                        <span style={{ fontSize: '11px', color: '#6b5744' }}>{s._count.chapters} chuong</span>
                                                    </div>
                                                </div>
                                            </a>
                                        ))}
                                    </div>
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
