"use client";

// D:\Webtruyen\webtruyen-app\src\components\story\StoryInteractions.tsx

import { useState, useEffect, useRef, useCallback } from "react";
import { useReadingHistory } from "@/hooks/useReadingHistory";
import { Heart, Bookmark, Trophy, X, CheckCircle2, Info, Clock } from "lucide-react";
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

// ── Toast system — bottom-right, 10s ──
type ToastType = 'success' | 'info' | 'warning';

interface ToastItem {
    id: number;
    message: string;
    type: ToastType;
}

function ToastPortal({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
    if (toasts.length === 0) return null;
    return (
        <div
            className="fixed bottom-6 right-4 z-[9999] flex flex-col gap-2 items-end pointer-events-none"
            style={{ maxWidth: "min(calc(100vw - 32px), 360px)" }}
        >
            {toasts.map(toast => (
                <div
                    key={toast.id}
                    className="pointer-events-auto w-full animate-in fade-in slide-in-from-right-4 duration-300"
                    role="status"
                    aria-live="polite"
                >
                    <div className={`flex items-start gap-2.5 px-4 py-3.5 rounded-2xl text-sm font-medium border shadow-2xl backdrop-blur-md ${
                        toast.type === 'success'
                            ? 'bg-green-900/90 border-green-600/50 text-green-100'
                            : toast.type === 'warning'
                            ? 'bg-zinc-900/95 border-zinc-600/50 text-zinc-200'
                            : 'bg-blue-900/90 border-blue-600/50 text-blue-100'
                    }`}>
                        <span className="shrink-0 mt-0.5">
                            {toast.type === 'success' && <CheckCircle2 className="h-4 w-4" />}
                            {toast.type === 'info' && <Info className="h-4 w-4" />}
                            {toast.type === 'warning' && <Clock className="h-4 w-4" />}
                        </span>
                        <span className="flex-1 leading-snug">{toast.message}</span>
                        <button
                            onClick={() => onDismiss(toast.id)}
                            className="shrink-0 opacity-60 hover:opacity-100 mt-0.5 transition-opacity"
                            aria-label="Đóng thông báo"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}

function useToast() {
    const [toasts, setToasts] = useState<ToastItem[]>([]);
    const counterRef = useRef(0);

    const addToast = useCallback((message: string, type: ToastType = 'info') => {
        const id = ++counterRef.current;
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 10000);
    }, []);

    const dismissToast = useCallback((id: number) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    return { toasts, addToast, dismissToast };
}

function getToastType(message: string): ToastType {
    if (message.startsWith('Bạn nhận được')) return 'success';
    if (message.startsWith('Hãy quay lại')) return 'warning';
    return 'info';
}

export default function StoryInteractions({
    storyId, storySlug, firstChapterId, latestChapterId,
    stats: initialStats, userStatus: initialStatus, currentUser,
}: StoryInteractionsProps) {
    const [stats, setStats] = useState(initialStats);
    const [mounted, setMounted] = useState(false);
    const { history } = useReadingHistory();
    const lastRead = history.find(h => h.slug === storySlug);
    const [status, setStatus] = useState(initialStatus);
    const [jumpChapter, setJumpChapter] = useState("");
    const [nominateLocked, setNominateLocked] = useState(false);
    const { toasts, addToast, dismissToast } = useToast();
    const router = useRouter();

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

    // ── [CHANGED] Like — không còn credit ──
    const handleLike = async () => {
        if (!checkAuth()) return;
        const newLiked = !status.isLiked;
        setStatus(prev => ({ ...prev, isLiked: newLiked }));
        setStats(prev => ({ ...prev, likeCount: prev.likeCount + (newLiked ? 1 : -1) }));
        const res = await toggleLike(storyId);
        if (res.error) {
            setStatus(prev => ({ ...prev, isLiked: !newLiked }));
            setStats(prev => ({ ...prev, likeCount: prev.likeCount + (newLiked ? -1 : 1) }));
            addToast(res.error, 'info');
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
            addToast(res.error, 'info');
        }
    };

    // ── [CHANGED] Đề cử — logic giống bình luận ──
    const handleNominate = async () => {
        if (!checkAuth()) return;
        if (!confirm("Bạn muốn đề cử cho truyện này?")) return;

        setStats(prev => ({ ...prev, nominationCount: prev.nominationCount + 1 }));
        const res = await nominateStory(storyId);

        if (res.error) {
            setStats(prev => ({ ...prev, nominationCount: prev.nominationCount - 1 }));
            addToast(res.error, 'info');
            return;
        }

        // Đã đề cử truyện này hôm nay → không tăng counter, toast + lock
        if (res.blocked && res.blockReason === 'SAME_STORY_TODAY') {
            setStats(prev => ({ ...prev, nominationCount: prev.nominationCount - 1 }));
            addToast(res.creditMessage, 'warning');
            setNominateLocked(true);
            return;
        }

        // Lưu thành công (có credit hoặc không)
        if (res.creditMessage) {
            addToast(res.creditMessage, getToastType(res.creditMessage));
        }
        // Lock nút đề cử truyện này tới 0h
        setNominateLocked(true);
    };

    const handleJumpToChapter = () => {
        if (!jumpChapter) return;
        const chapterNum = parseInt(jumpChapter);
        if (isNaN(chapterNum) || chapterNum < 1) {
            addToast("Vui lòng nhập số chương hợp lệ!", 'info');
            return;
        }
        router.push(`/truyen/${storySlug}/chuong-${chapterNum}`);
    };

    return (
        <div className="flex flex-col gap-3">
            {/* Toast portal — fixed bottom-right */}
            <ToastPortal toasts={toasts} onDismiss={dismissToast} />

            {/* Interaction bar */}
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
                    disabled={nominateLocked}
                    className={`flex-1 flex flex-col items-center transition-all active:scale-95 ${
                        nominateLocked
                            ? 'opacity-60 cursor-not-allowed bg-warm-bg'
                            : 'cursor-pointer bg-warm-bg hover:bg-amber-50'
                    }`}
                >
                    <div className="w-full text-center px-2 py-1 text-xs font-semibold border-b border-warm-border-soft text-warm-ink-soft bg-warm-bg">
                        {nominateLocked ? '✓ Đã đề cử' : '+ Đề cử'}
                    </div>
                    <div className="flex items-center justify-center gap-1.5 py-2.5">
                        <Trophy className={`h-4 w-4 sm:h-5 sm:w-5 ${nominateLocked ? 'text-amber-500 fill-current' : 'text-amber-400'}`} />
                        <span className="text-sm sm:text-base font-bold text-warm-ink">{stats.nominationCount}</span>
                    </div>
                </button>
            </div>

            {/* Chapter Navigation */}
            <div className="flex flex-nowrap items-center gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
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

                <a
                    href={`/truyen/${storySlug}/chuong-${firstChapterId || 1}`}
                    className="shrink-0 px-3 sm:px-4 h-8 sm:h-9 flex items-center rounded-xl font-bold text-sm sm:text-base text-[#8c3a08] bg-warm-primary-pale border-2 border-warm-primary/50 hover:bg-warm-primary hover:text-white whitespace-nowrap transition-all active:scale-95"
                >
                    <span className="sm:hidden">▶ C.1</span>
                    <span className="hidden sm:inline">▶ Chương 1</span>
                </a>

                <a
                    href={`/truyen/${storySlug}/chuong-${latestChapterId || 1}`}
                    className="shrink-0 px-3 sm:px-4 h-8 sm:h-9 flex items-center rounded-xl font-bold text-sm sm:text-base text-[#8c3a08] bg-warm-primary-pale border-2 border-warm-primary/50 hover:bg-warm-primary hover:text-white whitespace-nowrap transition-all active:scale-95"
                >
                    <span className="sm:hidden">⏭ C.End</span>
                    <span className="hidden sm:inline">⏭ Chương cuối</span>
                </a>
            </div>

            {/* Đọc gần đây */}
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
