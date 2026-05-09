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
        router.push(`/truyen/${storySlug}/nghe?chuong=${chapterNum}`);
    };

    return (
        <div className="flex flex-col gap-3">
            {/* Toast portal — fixed bottom-right */}
            <ToastPortal toasts={toasts} onDismiss={dismissToast} />

            {/* 3 stat cards */}
            <div className="grid grid-cols-3 gap-2">
                {/* Yêu thích */}
                <button
                    onClick={handleLike}
                    className={`flex flex-col items-center gap-1.5 py-4 px-2 rounded-2xl transition-all active:scale-95 cursor-pointer ${
                        status.isLiked
                            ? 'bg-red-500/10 ring-1 ring-red-500/30'
                            : 'bg-warm-card hover:bg-red-500/10'
                    }`}
                >
                    <Heart className={`h-5 w-5 transition-all ${status.isLiked ? 'fill-current text-red-500 scale-110' : 'text-red-400'}`} />
                    <span className={`text-lg font-bold leading-none ${status.isLiked ? 'text-red-500' : 'text-warm-ink'}`}>
                        {stats.likeCount}
                    </span>
                    <span className={`text-[11px] font-medium ${status.isLiked ? 'text-red-400' : 'text-warm-ink-soft'}`}>
                        {status.isLiked ? '✓ Yêu thích' : 'Yêu thích'}
                    </span>
                </button>

                {/* Theo dõi */}
                <button
                    onClick={handleFollow}
                    className={`flex flex-col items-center gap-1.5 py-4 px-2 rounded-2xl transition-all active:scale-95 cursor-pointer ${
                        status.isFollowed
                            ? 'bg-blue-500/10 ring-1 ring-blue-500/30'
                            : 'bg-warm-card hover:bg-blue-500/10'
                    }`}
                >
                    <Bookmark className={`h-5 w-5 transition-all ${status.isFollowed ? 'fill-current text-blue-500 scale-110' : 'text-blue-400'}`} />
                    <span className={`text-lg font-bold leading-none ${status.isFollowed ? 'text-blue-500' : 'text-warm-ink'}`}>
                        {stats.followCount}
                    </span>
                    <span className={`text-[11px] font-medium ${status.isFollowed ? 'text-blue-400' : 'text-warm-ink-soft'}`}>
                        {status.isFollowed ? '✓ Theo dõi' : 'Theo dõi'}
                    </span>
                </button>

                {/* Đề cử */}
                <button
                    onClick={handleNominate}
                    disabled={nominateLocked}
                    className={`flex flex-col items-center gap-1.5 py-4 px-2 rounded-2xl transition-all active:scale-95 ${
                        nominateLocked
                            ? 'bg-amber-500/10 ring-1 ring-amber-500/30 cursor-not-allowed'
                            : 'bg-warm-card hover:bg-amber-500/10 cursor-pointer'
                    }`}
                >
                    <Trophy className={`h-5 w-5 ${nominateLocked ? 'text-amber-500 fill-current' : 'text-amber-400'}`} />
                    <span className="text-lg font-bold leading-none text-warm-ink">{stats.nominationCount}</span>
                    <span className={`text-[11px] font-medium ${nominateLocked ? 'text-amber-400' : 'text-warm-ink-soft'}`}>
                        {nominateLocked ? '✓ Đề cử' : 'Đề cử'}
                    </span>
                </button>
            </div>

            {/* CTA — Nghe truyện */}
            <a
                href={`/truyen/${storySlug}/nghe?chuong=1`}
                className="block w-full text-center py-3.5 rounded-2xl font-bold text-white text-base tracking-wide transition-all active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #e8580a 0%, #c94400 100%)' }}
            >
                ▶ Nghe Truyện
            </a>

            {/* Nghe gần đây */}
            {mounted && lastRead?.chapterIndex && (
                <a
                    href={`/truyen/${storySlug}/nghe?chuong=${lastRead.chapterIndex}`}
                    className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-warm-card hover:bg-warm-primary-pale transition-colors group"
                >
                    <span className="w-2 h-2 rounded-full bg-warm-primary shrink-0" aria-hidden="true" />
                    <span className="text-sm font-medium text-warm-ink-soft flex-1">Nghe gần đây</span>
                    <span className="text-sm font-bold text-warm-primary group-hover:underline transition-colors">
                        Chương {lastRead.chapterIndex} →
                    </span>
                </a>
            )}
        </div>
    );
}
