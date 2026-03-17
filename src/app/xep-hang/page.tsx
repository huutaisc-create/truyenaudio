import React from 'react';
import { BookOpen, User, Flame, TrendingUp, Award, Clock, ChevronRight, Heart, Bookmark, CheckCircle, Sparkles } from 'lucide-react';
import db from '@/lib/db';
import Link from 'next/link';
import { formatNumber } from '@/lib/utils';

export const revalidate = 60;

const RankingPage = async ({ searchParams: searchParamsPromise }: { searchParams: Promise<{ tab?: string; page?: string }> }) => {
    const searchParams = await searchParamsPromise;
    const tab = searchParams.tab || 'hot';
    const page = parseInt(searchParams.page || '1');
    const limit = 20;
    const offset = (page - 1) * limit;

    const categories = [
        { id: 'hot', title: "Truyện Hot", icon: <Flame className="h-4 w-4" />, description: "Truyện có lượt đọc cao nhất" },
        { id: 'nomination', title: "Đề Cử", icon: <Award className="h-4 w-4" />, description: "Truyện được đề cử nhiều nhất" },
        { id: 'like', title: "Yêu Thích", icon: <Heart className="h-4 w-4" />, description: "Truyện được thả tim nhiều nhất" },
        { id: 'follow', title: "Theo Dõi", icon: <Bookmark className="h-4 w-4" />, description: "Truyện được theo dõi nhiều nhất" },
        { id: 'new', title: "Truyện Mới", icon: <Sparkles className="h-4 w-4" />, description: "Truyện mới đăng gần đây" },
        { id: 'completed', title: "Đã Hoàn Thành", icon: <CheckCircle className="h-4 w-4" />, description: "Truyện đã ra trọn bộ" },
    ];

    const currentCategory = categories.find(c => c.id === tab) || categories[0];

    // Build Query
    let orderBy: any = { viewCount: 'desc' };
    let where: any = {};

    switch (tab) {
        case 'hot':
            orderBy = { viewCount: 'desc' };
            break;
        case 'nomination':
            orderBy = { nominationCount: 'desc' };
            break;
        case 'like':
            orderBy = { likeCount: 'desc' };
            break;
        case 'follow':
            orderBy = { followCount: 'desc' };
            break;
        case 'new':
            orderBy = { createdAt: 'desc' };
            break;
        case 'completed':
            where = { status: 'COMPLETED' };
            orderBy = { viewCount: 'desc' }; // Completed stories sorted by views
            break;
        default:
            orderBy = { viewCount: 'desc' };
    }

    // Determine Ranking Metric to Display
    const getMetricLabel = (story: any) => {
        switch (tab) {
            case 'hot': return `Lượt xem: ${formatNumber(story.viewCount)}`;
            case 'nomination': return `Đề cử: ${formatNumber(story.nominationCount || 0)}`;
            case 'like': return `Yêu thích: ${formatNumber(story.likeCount || 0)}`;
            case 'follow': return `Theo dõi: ${formatNumber(story.followCount || 0)}`;
            case 'new': return `Ngày tạo: ${new Date(story.createdAt).toLocaleDateString('vi-VN')}`;
            case 'completed': return `Trạng thái: Hoàn Thành`;
            default: return `Lượt xem: ${formatNumber(story.viewCount)}`;
        }
    };

    // Fetch Data
    const stories = await db.story.findMany({
        where,
        orderBy,
        take: limit,
        skip: offset,
        include: {
            genres: { take: 3 },
            _count: { select: { chapters: true } }
        }
    });

    const totalStories = await db.story.count({ where });
    const totalPages = Math.ceil(totalStories / limit);

    return (
        <div className="bg-[#fdfdfd] min-h-screen pb-24">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">

                {/* Header Section */}
                {/* Header Section */}
                <div className="py-2 md:py-6 border-b border-zinc-100 mb-4 md:mb-6">
                    {/* Mobile: Compact Header */}
                    <h1 className="text-lg md:text-xl font-bold text-zinc-900 mb-1 md:mb-2 tracking-tight uppercase italic border-l-4 md:border-l-8 border-brand-primary pl-2 md:pl-4">Bảng Xếp Hạng</h1>
                    <p className="text-zinc-500 text-[10px] md:text-sm">{currentCategory.description}</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-12">

                    {/* Tabs Sidebar (Left 3/12) */}
                    <div className="lg:col-span-2 grid grid-cols-3 lg:flex lg:flex-col gap-2 lg:gap-0 lg:space-y-2 sticky top-14 md:top-16 z-20 bg-[#fdfdfd] lg:static pb-2 lg:pb-0 pt-2 lg:pt-0 border-b lg:border-0 border-zinc-100 lg:bg-transparent">
                        {categories.map((cat) => (
                            <Link
                                key={cat.id}
                                href={`/xep-hang?tab=${cat.id}`}
                                className={`w-full flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-1 md:gap-3 px-1 py-1.5 md:px-6 md:py-4 rounded-lg lg:rounded-xl text-[10px] sm:text-xs md:text-sm font-bold transition-all whitespace-nowrap ${tab === cat.id
                                    ? 'bg-brand-primary text-white shadow-md lg:shadow-lg shadow-orange-500/20'
                                    : 'bg-zinc-100 lg:bg-transparent text-zinc-600 hover:bg-zinc-200 lg:hover:bg-zinc-100 hover:text-brand-primary'
                                    }`}
                            >
                                {cat.icon}
                                <span>{cat.title}</span>
                            </Link>
                        ))}
                    </div>

                    {/* Ranking List (Right 10/12) */}
                    <div className="lg:col-span-10">
                        {/* Mobile: List View */}
                        <div className="lg:hidden bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
                            {stories.length === 0 ? (
                                <div className="p-12 text-center text-zinc-500">Chưa có dữ liệu cho mục này.</div>
                            ) : (
                                stories.map((story, idx) => {
                                    const realIndex = offset + idx + 1;
                                    return (
                                        <Link href={`/truyen/${story.slug}`} key={story.id} className="flex gap-3 md:gap-6 p-3 md:p-6 border-b border-zinc-50 last:border-0 hover:bg-zinc-50 transition-colors group cursor-pointer items-start md:items-center">
                                            {/* Rank Number */}
                                            <div className="flex shrink-0 items-center justify-center w-6 md:w-8 mt-1 md:mt-0">
                                                <span className={`text-lg md:text-2xl font-black italic ${realIndex === 1 ? 'text-red-500 scale-125' :
                                                    realIndex === 2 ? 'text-orange-500 scale-110' :
                                                        realIndex === 3 ? 'text-yellow-500' : 'text-zinc-300'
                                                    }`}>
                                                    {realIndex}
                                                </span>
                                            </div>

                                            {/* Cover Placeholder */}
                                            <div className="w-16 h-24 md:w-24 md:h-32 shrink-0 bg-zinc-100 rounded-lg shadow-sm group-hover:shadow-md transition-all flex items-center justify-center overflow-hidden relative">
                                                {story.coverImage ? (
                                                    <img src={story.coverImage} alt={story.title} className="w-full h-full object-cover" />
                                                ) : (
                                                    <BookOpen className="h-6 w-6 md:h-8 md:w-8 text-zinc-300 opacity-20" />
                                                )}

                                                {/* Status Badge */}
                                                {story.status === 'COMPLETED' && (
                                                    <span className="absolute top-0 right-0 bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 shadow-sm z-10 uppercase tracking-wider">
                                                        Full
                                                    </span>
                                                )}
                                            </div>

                                            {/* Meta */}
                                            <div className="flex-1 min-w-0 space-y-2 py-1">
                                                <h3 className="text-lg font-bold text-zinc-800 truncate group-hover:text-brand-primary transition-colors">{story.title}</h3>
                                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
                                                    <span className="flex items-center gap-1"><User className="h-3 w-3" /> {story.author}</span>
                                                    {story.genres.map(g => (
                                                        <span key={g.id} className="flex items-center gap-1 uppercase font-bold text-brand-primary/70 border border-brand-primary/10 px-1 rounded">{g.name}</span>
                                                    ))}
                                                </div>
                                                <div className="flex gap-6 pt-2 text-[12px] font-medium text-zinc-400">
                                                    <span>Số chương: <span className="text-zinc-700 font-bold">{formatNumber(story._count.chapters)}</span></span>
                                                    <span className="text-brand-primary font-bold">{getMetricLabel(story)}</span>
                                                </div>
                                            </div>

                                            <div className="hidden sm:flex items-center justify-center w-10 h-10 rounded-full border border-zinc-100 text-zinc-400 group-hover:text-brand-primary group-hover:border-brand-primary transition-all self-center shrink-0">
                                                <ChevronRight className="h-5 w-5" />
                                            </div>
                                        </Link>
                                    );
                                })
                            )}
                        </div>

                        {/* Desktop: Grid View (6 Columns) */}
                        <div className="hidden lg:grid grid-cols-6 gap-3">
                            {stories.length === 0 ? (
                                <div className="col-span-3 p-12 text-center text-zinc-500 bg-white rounded-xl border border-zinc-100 shadow-sm">Chưa có dữ liệu cho mục này.</div>
                            ) : (
                                stories.map((story, idx) => {
                                    const realIndex = offset + idx + 1;
                                    return (
                                        <Link href={`/truyen/${story.slug}`} key={story.id} className="group bg-white rounded-xl border border-zinc-200 overflow-hidden hover:shadow-lg transition-all duration-300 flex flex-col h-full relative">
                                            {/* Rank Badge */}
                                            <div className="absolute top-2 left-2 z-20 flex items-center justify-center w-8 h-8 rounded-full bg-white/90 backdrop-blur shadow-md border border-zinc-100">
                                                <span className={`text-lg font-black italic ${realIndex === 1 ? 'text-red-500' : realIndex === 2 ? 'text-orange-500' : realIndex === 3 ? 'text-yellow-500' : 'text-zinc-400'}`}>
                                                    {realIndex}
                                                </span>
                                            </div>

                                            <div className="w-full aspect-[2/3] bg-zinc-100 shrink-0 flex items-center justify-center overflow-hidden relative">
                                                {story.coverImage ? (
                                                    <img src={story.coverImage} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt={story.title} />
                                                ) : (
                                                    <BookOpen className="h-12 w-12 text-zinc-300 opacity-20" />
                                                )}
                                                {story.status === 'COMPLETED' && (
                                                    <span className="absolute top-0 right-0 bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 shadow-sm z-10 uppercase tracking-wider">
                                                        Full
                                                    </span>
                                                )}
                                            </div>

                                            <div className="p-4 flex flex-col flex-1 gap-2">
                                                <h3 className="font-bold text-base text-zinc-900 group-hover:text-brand-primary transition-colors line-clamp-2 leading-tight min-h-[2.5rem]">{story.title}</h3>
                                                <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                                                    <span className="flex items-center gap-1 truncate max-w-full"><User className="h-3 w-3 shrink-0" /> {story.author}</span>
                                                </div>
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {story.genres[0] && (
                                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold text-zinc-600 bg-zinc-100 border border-zinc-200 uppercase">{story.genres[0].name}</span>
                                                    )}
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${story.status === 'COMPLETED' ? 'text-green-600 bg-green-50 border-green-200' : 'text-blue-600 bg-blue-50 border-blue-200'}`}>
                                                        {story.status === 'COMPLETED' ? 'FULL' : 'Đang ra'}
                                                    </span>
                                                </div>
                                                <div className="mt-auto pt-3 border-t border-zinc-50 flex items-center justify-between text-xs font-medium text-zinc-500">
                                                    <span>{formatNumber(story._count.chapters)} chương</span>
                                                    <span className="text-brand-primary font-bold">{getMetricLabel(story).split(': ')[1]}</span>
                                                </div>
                                            </div>
                                        </Link>
                                    );
                                })
                            )}
                        </div>

                        {/* Pagination */}
                        <div className="mt-12 flex justify-center gap-2">
                            {page > 1 && (
                                <Link href={`/xep-hang?tab=${tab}&page=${page - 1}`} className="px-4 py-2 bg-white border border-zinc-200 text-zinc-600 rounded-lg text-sm hover:bg-zinc-50 font-bold">
                                    Trước
                                </Link>
                            )}

                            <span className="px-4 py-2 bg-brand-primary text-white rounded-lg text-sm font-bold">
                                Trang {page}
                            </span>

                            {page < totalPages && (
                                <Link href={`/xep-hang?tab=${tab}&page=${page + 1}`} className="px-4 py-2 bg-white border border-zinc-200 text-zinc-600 rounded-lg text-sm hover:bg-zinc-50 font-bold">
                                    Sau
                                </Link>
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default RankingPage;

