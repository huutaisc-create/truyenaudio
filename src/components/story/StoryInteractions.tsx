"use client";

import { useState, useEffect } from "react";
import { useReadingHistory } from "@/hooks/useReadingHistory";
import { Heart, Bookmark, Trophy } from "lucide-react";
import { toggleFollow, toggleLike, nominateStory } from "@/actions/interactions";
import { useRouter } from "next/navigation";

type StoryInteractionsProps = {
    storyId: string;
    storySlug: string;
    firstChapterId: number;
    latestChapterId: number;
    stats: {
        likeCount: number;
        followCount: number;
        nominationCount: number;
        viewCount: number;
    };
    userStatus: {
        isLiked: boolean;
        isFollowed: boolean;
        lastReadChapterId: number | null;
        nominationCount?: number;
    };
    currentUser: any;
};

export default function StoryInteractions({ storyId, storySlug, firstChapterId, latestChapterId, stats: initialStats, userStatus: initialStatus, currentUser }: StoryInteractionsProps) {
    const [stats, setStats] = useState(initialStats);
    const [mounted, setMounted] = useState(false);
    const { history } = useReadingHistory();
    const lastRead = history.find(h => h.slug === storySlug);
    const [status, setStatus] = useState(initialStatus);
    const [jumpChapter, setJumpChapter] = useState("");
    const router = useRouter();

    // FIX: mounted check để tránh hydration mismatch → hiện trên mobile
    useEffect(() => { setMounted(true); }, []);

    const checkAuth = () => {
        if (!currentUser) {
            if (confirm("Bạn cần đăng nhập để thực hiện chức năng này. Đăng nhập ngay?")) {
                router.push("/login?callbackUrl=" + window.location.pathname);
            }
            return false;
        }
        return true;
    };

    const handleLike = async () => {
        if (!checkAuth()) return;
        const newLiked = !status.isLiked;
        setStatus(prev => ({ ...prev, isLiked: newLiked }));
        setStats(prev => ({ ...prev, likeCount: prev.likeCount + (newLiked ? 1 : -1) }));
        const res = await toggleLike(storyId);
        if (res.error) {
            setStatus(prev => ({ ...prev, isLiked: !newLiked }));
            setStats(prev => ({ ...prev, likeCount: prev.likeCount + (newLiked ? -1 : 1) }));
            alert(res.error);
        }
    };

    const handleFollow = async () => {
        if (!checkAuth()) return;
        const newFollowed = !status.isFollowed;
        setStatus(prev => ({ ...prev, isFollowed: newFollowed }));
        setStats(prev => ({ ...prev, followCount: prev.followCount + (newFollowed ? 1 : -1) }));
        const res = await toggleFollow(storyId);
        if (res.error) {
            setStatus(prev => ({ ...prev, isFollowed: !newFollowed }));
            setStats(prev => ({ ...prev, followCount: prev.followCount + (newFollowed ? -1 : 1) }));
            alert(res.error);
        }
    };

    const handleNominate = async () => {
        if (!checkAuth()) return;
        if (!confirm("Bạn muốn đề cử cho truyện này?")) return;
        setStats(prev => ({ ...prev, nominationCount: prev.nominationCount + 1 }));
        const res = await nominateStory(storyId);
        if (res.error) {
            setStats(prev => ({ ...prev, nominationCount: prev.nominationCount - 1 }));
            alert(res.error);
        } else {
            alert("Đề cử thành công!");
        }
    };

    const handleJumpToChapter = () => {
        if (!jumpChapter) return;
        const chapterNum = parseInt(jumpChapter);
        if (isNaN(chapterNum) || chapterNum < 1) {
            alert("Vui lòng nhập số chương hợp lệ!");
            return;
        }
        router.push(`/truyen/${storySlug}/chuong-${chapterNum}`);
    };

    return (
        <div className="flex flex-col gap-3">

            {/* Interaction bar — label trên, icon+số dưới, click tăng */}
            <div className="flex rounded-xl overflow-hidden border border-warm-border-soft">

                {/* Yêu thích */}
                <button
                    onClick={handleLike}
                    className={`flex-1 flex flex-col items-center cursor-pointer transition-all active:scale-95 ${
                        status.isLiked ? 'bg-red-50' : 'bg-warm-bg hover:bg-red-50'
                    }`}
                >
                    <div className={`w-full text-center px-2 py-1 text-xs font-semibold border-b border-warm-border-soft ${
                        status.isLiked ? 'text-red-400 bg-red-50' : 'text-warm-ink-soft bg-warm-bg'
                    }`}>+ Yêu thích</div>
                    <div className="flex items-center justify-center gap-1.5 py-2.5">
                        <Heart className={`h-4 w-4 sm:h-5 sm:w-5 transition-all ${status.isLiked ? 'fill-current text-red-500 scale-110' : 'text-red-400'}`} />
                        <span className={`text-sm sm:text-base font-bold ${status.isLiked ? 'text-red-500' : 'text-warm-ink'}`}>{stats.likeCount}</span>
                    </div>
                </button>

                <div className="w-px bg-warm-border-soft" />

                {/* Theo dõi */}
                <button
                    onClick={handleFollow}
                    className={`flex-1 flex flex-col items-center cursor-pointer transition-all active:scale-95 ${
                        status.isFollowed ? 'bg-blue-50' : 'bg-warm-bg hover:bg-blue-50'
                    }`}
                >
                    <div className={`w-full text-center px-2 py-1 text-xs font-semibold border-b border-warm-border-soft ${
                        status.isFollowed ? 'text-blue-500 bg-blue-50' : 'text-warm-ink-soft bg-warm-bg'
                    }`}>+ Theo dõi</div>
                    <div className="flex items-center justify-center gap-1.5 py-2.5">
                        <Bookmark className={`h-4 w-4 sm:h-5 sm:w-5 transition-all ${status.isFollowed ? 'fill-current text-blue-600 scale-110' : 'text-blue-400'}`} />
                        <span className={`text-sm sm:text-base font-bold ${status.isFollowed ? 'text-blue-600' : 'text-warm-ink'}`}>{stats.followCount}</span>
                    </div>
                </button>

                <div className="w-px bg-warm-border-soft" />

                {/* Đề cử */}
                <button
                    onClick={handleNominate}
                    className="flex-1 flex flex-col items-center cursor-pointer bg-warm-bg hover:bg-amber-50 transition-all active:scale-95"
                >
                    <div className="w-full text-center px-2 py-1 text-xs font-semibold border-b border-warm-border-soft text-warm-ink-soft bg-warm-bg">+ Đề cử</div>
                    <div className="flex items-center justify-center gap-1.5 py-2.5">
                        <Trophy className="h-4 w-4 sm:h-5 sm:w-5 text-amber-400" />
                        <span className="text-sm sm:text-base font-bold text-warm-ink">{stats.nominationCount}</span>
                    </div>
                </button>

            </div>

            {/* Chapter Navigation */}
            <div className="flex flex-nowrap items-center gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                {/* Search */}
                <div className="flex h-9 shrink-0 rounded-xl overflow-hidden border border-warm-border">
                    <input
                        type="number"
                        placeholder="Số chương..."
                        value={jumpChapter}
                        onChange={(e) => setJumpChapter(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleJumpToChapter()}
                        className="w-[88px] px-3 text-base bg-warm-bg text-warm-ink outline-none placeholder:text-warm-ink-soft border-r border-warm-border"
                    />
                    <button
                        onClick={handleJumpToChapter}
                        className="px-3 text-base font-bold bg-warm-border-soft text-[#8c3a08] hover:bg-warm-primary-pale transition-colors whitespace-nowrap"
                    >
                        Đi
                    </button>
                </div>

                {/* Chương 1 */}
                <a
                    href={`/truyen/${storySlug}/chuong-${firstChapterId || 1}`}
                    className="shrink-0 px-3 sm:px-4 h-8 sm:h-9 flex items-center rounded-xl font-bold text-sm sm:text-base text-[#8c3a08] bg-warm-primary-pale border-2 border-warm-primary/50 hover:bg-warm-primary hover:text-white whitespace-nowrap transition-all active:scale-95"
                >
                    <span className="sm:hidden">▶ C.1</span>
                    <span className="hidden sm:inline">▶ Chương 1</span>
                </a>

                {/* Chương cuối */}
                <a
                    href={`/truyen/${storySlug}/chuong-${latestChapterId || 1}`}
                    className="shrink-0 px-3 sm:px-4 h-8 sm:h-9 flex items-center rounded-xl font-bold text-sm sm:text-base text-[#8c3a08] bg-warm-primary-pale border-2 border-warm-primary/50 hover:bg-warm-primary hover:text-white whitespace-nowrap transition-all active:scale-95"
                >
                    <span className="sm:hidden">⏭ C.End</span>
                    <span className="hidden sm:inline">⏭ Chương cuối</span>
                </a>
            </div>

            {/* Đọc gần đây — chỉ hiện nếu user đã đọc truyện này */}
            {mounted && lastRead?.chapterIndex && (
                <a
                    href={`/truyen/${storySlug}/chuong-${lastRead?.chapterIndex || 1}`}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-warm-border-soft bg-warm-bg hover:bg-warm-primary-pale transition-colors group"
                >
                    <span aria-hidden="true" className="text-sm">🕐</span>
                    <span className="text-sm font-medium text-warm-ink-soft">Đọc gần đây</span>
                    <span className="text-sm font-bold text-[#8c3a08] group-hover:text-warm-primary transition-colors">
                        Chương {lastRead.chapterIndex} →
                    </span>
                </a>
            )}
        </div>
    );
}
