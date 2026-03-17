import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import React from 'react';
import { formatNumber } from '@/lib/utils';

interface StoryMinimal {
    id: string;
    title: string;
    slug: string;
    coverImage: string | null;
    author: string;
    status: string; // Added status
    genres: { name: string }[];
    // Dynamic counts
    nominationCount?: number;
    viewCount?: number;
    ratingScore?: number; // Used for "Yêu thích" maybe? Or likeCount
    likeCount?: number;
    followCount?: number;
}

interface RankingColumnProps {
    title: string;
    icon?: React.ReactNode; // Optional icon if needed
    stories: StoryMinimal[];
    countKey: keyof StoryMinimal;
    countLabel: string;
    colorClass: string; // e.g. text-red-600
    tab: string;
}

const RankingColumn = ({ title, stories, countKey, countLabel, colorClass, tab }: RankingColumnProps) => {
    const top1 = stories[0];
    const others = stories.slice(1);

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between border-b pb-2 border-zinc-200">
                <h3 className="text-lg font-bold text-zinc-800 uppercase">{title}</h3>
                <Link href={`/xep-hang?tab=${tab}`} className="text-xs text-zinc-500 hover:text-brand-primary">Tất cả &gt;</Link>
            </div>

            {/* Top 1 */}
            {top1 && (
                <div className="flex gap-4">
                    <div className="w-1/3 shrink-0 relative">
                        {/* Rank 1 Badge */}
                        <span className="absolute top-0 left-0 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 z-10">NO.1</span>
                        {/* Status Badge */}
                        {top1.status === 'COMPLETED' && (
                            <span className="absolute top-0 right-0 bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 shadow-sm z-10 uppercase tracking-wider">
                                Full
                            </span>
                        )}
                        <Link href={`/truyen/${top1.slug}`} className="block aspect-[2/3] bg-zinc-100 rounded overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                            {top1.coverImage ? (
                                <img src={top1.coverImage} alt={top1.title} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-zinc-200 text-zinc-400">
                                    <BookOpen className="w-6 h-6" />
                                </div>
                            )}
                        </Link>
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                        <Link href={`/truyen/${top1.slug}`} className="font-bold text-sm text-zinc-800 hover:text-brand-primary line-clamp-2 leading-tight">
                            {top1.title}
                        </Link>
                        <div className={`text-sm font-bold ${colorClass}`}>
                            {formatNumber(top1[countKey] as number || 0)} <span className="text-[10px] font-normal text-zinc-500">{countLabel}</span>
                        </div>
                        <div className="text-[11px] text-zinc-500 truncate mt-auto">
                            {top1.genres[0]?.name}
                        </div>
                        <div className="text-[11px] text-zinc-400 truncate">
                            {top1.author}
                        </div>
                    </div>
                </div>
            )}

            {/* List 2-10 */}
            <div className="flex flex-col gap-3 mt-2">
                {others.map((story, idx) => (
                    <div key={story.id} className="flex items-center gap-3">
                        <span className={`flex items-center justify-center w-5 h-5 rounded text-[11px] font-bold shrink-0 ${idx < 2 ? 'bg-orange-100 text-orange-600' : 'bg-zinc-100 text-zinc-500'}`}>
                            {idx + 2}
                        </span>
                        <Link href={`/truyen/${story.slug}`} className="flex-1 min-w-0 text-sm text-zinc-700 hover:text-brand-primary truncate">
                            {story.title}
                        </Link>
                        <span className="text-[11px] text-zinc-400 shrink-0">
                            {formatNumber(story[countKey] as number || 0)}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default function RankingBoard({
    topNominations,
    topViews,
    topLikes,
    topFollows
}: {
    topNominations: StoryMinimal[],
    topViews: StoryMinimal[],
    topLikes: StoryMinimal[],
    topFollows: StoryMinimal[]
}) {
    return (
        <section className="bg-white rounded-xl shadow-sm border border-zinc-100 p-4 sm:p-6 mb-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                <RankingColumn
                    title="Đề cử"
                    stories={topNominations}
                    countKey="nominationCount"
                    countLabel="Đề cử"
                    colorClass="text-red-500"
                    tab="nomination"
                />
                <RankingColumn
                    title="Xem nhiều"
                    stories={topViews}
                    countKey="viewCount"
                    countLabel="Lượt xem"
                    colorClass="text-brand-primary"
                    tab="hot"
                />
                <RankingColumn
                    title="Yêu thích"
                    stories={topLikes}
                    countKey="likeCount"
                    countLabel="Lượt thích"
                    colorClass="text-pink-500"
                    tab="like"
                />
                <RankingColumn
                    title="Theo dõi nhiều"
                    stories={topFollows}
                    countKey="followCount"
                    countLabel="Lượt theo dõi"
                    colorClass="text-blue-500"
                    tab="follow"
                />
            </div>
        </section>
    );
}
