"use client";

import { useState } from "react";
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
    const [status, setStatus] = useState(initialStatus);
    const [jumpChapter, setJumpChapter] = useState("");
    const router = useRouter();

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

            {/* Action Buttons */}
            <div className="grid grid-cols-3 gap-2">
                <button
                    onClick={handleLike}
                    className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-base font-bold transition-all active:scale-95 border ${
                        status.isLiked
                            ? 'bg-red-50 text-red-500 border-red-200'
                            : 'bg-warm-bg text-warm-ink-mid border-warm-border hover:bg-red-50 hover:text-red-500 hover:border-red-200'
                    }`}
                >
                    <Heart className={`h-4 w-4 ${status.isLiked ? 'fill-current' : ''}`} />
                    Yêu thích
                </button>

                <button
                    onClick={handleFollow}
                    className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-base font-bold transition-all active:scale-95 border ${
                        status.isFollowed
                            ? 'bg-blue-50 text-blue-600 border-blue-200'
                            : 'bg-warm-bg text-warm-ink-mid border-warm-border hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200'
                    }`}
                >
                    <Bookmark className={`h-4 w-4 ${status.isFollowed ? 'fill-current' : ''}`} />
                    Theo dõi
                </button>

                <button
                    onClick={handleNominate}
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-base font-bold bg-warm-bg text-warm-ink-mid border border-warm-border hover:bg-amber-50 hover:text-amber-500 hover:border-amber-200 transition-all active:scale-95"
                >
                    <Trophy className="h-4 w-4" />
                    Đề cử
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
                        className="px-3 text-base font-bold bg-warm-border-soft text-[#8c3a08] hover:bg-warm-primary-pale transition-colors"
                    >
                        Tìm
                    </button>
                </div>

                {/* Chương 1 */}
                <a
                    href={`/truyen/${storySlug}/chuong-${firstChapterId || 1}`}
                    className="shrink-0 px-4 h-9 flex items-center rounded-xl font-bold text-base text-white bg-warm-primary hover:opacity-90 whitespace-nowrap transition-all active:scale-95 border-2 border-warm-primary"
                >
                    ▶ Chương 1
                </a>

                {/* Chương cuối */}
                <a
                    href={`/truyen/${storySlug}/chuong-${latestChapterId || 1}`}
                    className="shrink-0 px-4 h-9 flex items-center rounded-xl font-bold text-base text-[#8c3a08] bg-warm-primary-pale border-2 border-warm-primary/50 hover:bg-warm-primary hover:text-white whitespace-nowrap transition-all active:scale-95"
                >
                    ⏭ Chương cuối
                </a>
            </div>
        </div>
    );
}
