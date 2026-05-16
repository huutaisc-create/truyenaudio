"use client";

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
        isNominatedToday?: boolean;
    };
    currentUser: any;
};

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
                            aria-label="Dong thong bao"
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
    if (message.startsWith('Ban nhan duoc')) return 'success';
    if (message.startsWith('Hay quay lai')) return 'warning';
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
    const [nominateLocked, setNominateLocked] = useState(initialStatus.isNominatedToday ?? false);
    const { toasts, addToast, dismissToast } = useToast();
    const router = useRouter();

    useEffect(() => { setMounted(true); }, []);

    const checkAuth = () => {
        if (!currentUser) {
            if (confirm("Ban can dang nhap de thuc hien chuc nang nay. Dang nhap ngay?")) {
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
            // Revert optimistic update on error
            setStatus(prev => ({ ...prev, isLiked: !newLiked }));
            setStats(prev => ({ ...prev, likeCount: prev.likeCount + (newLiked ? -1 : 1) }));
            addToast(res.error, 'info');
        } else if (res.liked !== undefined) {
            // Sync with actual server state to prevent drift
            const actualLiked = res.liked as boolean;
            setStatus(prev => ({ ...prev, isLiked: actualLiked }));
            setStats(prev => ({
                ...prev,
                likeCount: prev.likeCount + (actualLiked === newLiked ? 0 : actualLiked ? 1 : -1),
            }));
        }
    };

    const handleFollow = async () => {
        if (!checkAuth()) return;
        const newFollowed = !status.isFollowed;
        setStatus(prev => ({ ...prev, isFollowed: newFollowed }));
        setStats(prev => ({ ...prev, followCount: prev.followCount + (newFollowed ? 1 : -1) }));
        const res = await toggleFollow(storyId);
        if (res.error) {
            // Revert optimistic update on error
            setStatus(prev => ({ ...prev, isFollowed: !newFollowed }));
            setStats(prev => ({ ...prev, followCount: prev.followCount + (newFollowed ? -1 : 1) }));
            addToast(res.error, 'info');
        } else if (res.followed !== undefined) {
            // Sync with actual server state to prevent drift
            const actualFollowed = res.followed as boolean;
            setStatus(prev => ({ ...prev, isFollowed: actualFollowed }));
            setStats(prev => ({
                ...prev,
                followCount: prev.followCount + (actualFollowed === newFollowed ? 0 : actualFollowed ? 1 : -1),
            }));
        }
    };

    const handleNominate = async () => {
        if (!checkAuth()) return;
        if (!confirm("Ban muon de cu cho truyen nay?")) return;

        setStats(prev => ({ ...prev, nominationCount: prev.nominationCount + 1 }));
        const res = await nominateStory(storyId);

        if (res.error) {
            setStats(prev => ({ ...prev, nominationCount: prev.nominationCount - 1 }));
            addToast(res.error, 'info');
            return;
        }

        if (res.blocked && res.blockReason === 'SAME_STORY_TODAY') {
            setStats(prev => ({ ...prev, nominationCount: prev.nominationCount - 1 }));
            addToast(res.creditMessage, 'warning');
            setNominateLocked(true);
            return;
        }

        if (res.creditMessage) {
            addToast(res.creditMessage, getToastType(res.creditMessage));
        }
        setNominateLocked(true);
    };

    return (
        <div className="flex flex-col gap-3">
            <ToastPortal toasts={toasts} onDismiss={dismissToast} />

            {/* Row: Nghe Truyen + Nghe gan day + Moi nhat */}
            <div className="flex gap-2 items-stretch flex-wrap">
                <a
                    href={`/truyen/${storySlug}/nghe?chuong=1`}
                    className="flex items-center justify-center gap-2 py-3 px-6 rounded-2xl font-bold text-white text-sm tracking-wide transition-all active:scale-[0.98] flex-1"
                    style={{ background: 'linear-gradient(135deg,#e8580a 0%,#c94400 100%)', minWidth: '160px', boxShadow: '0 4px 16px rgba(232,88,10,0.3)' }}
                >
                    &#9654; Nghe Truyen
                </a>

                {mounted && lastRead?.chapterIndex ? (
                    <a
                        href={`/truyen/${storySlug}/nghe?chuong=${lastRead.chapterIndex}`}
                        className="flex items-center gap-2 px-4 py-3 rounded-2xl font-bold text-sm transition-all active:scale-[0.98] shrink-0"
                        style={{ background: 'rgba(232,88,10,0.1)', border: '1px solid rgba(232,88,10,0.3)', color: '#E8580A' }}
                    >
                        <Clock className="h-4 w-4" />
                        <span>Ch.{lastRead.chapterIndex}</span>
                    </a>
                ) : (
                    <a
                        href={`/truyen/${storySlug}/nghe?chuong=1`}
                        className="flex items-center gap-2 px-4 py-3 rounded-2xl font-bold text-sm transition-all active:scale-[0.98] shrink-0"
                        style={{ background: 'rgba(232,88,10,0.08)', border: '1px solid rgba(232,88,10,0.2)', color: '#c97a3a' }}
                    >
                        <span>Ch.1</span>
                        <span style={{ fontSize: '12px' }}>&#8594;</span>
                    </a>
                )}

                <a
                    href={`/truyen/${storySlug}/nghe?chuong=${latestChapterId}`}
                    className="flex items-center gap-2 px-4 py-3 rounded-2xl font-bold text-sm transition-all active:scale-[0.98] shrink-0"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#8B7355' }}
                >
                    <span>Moi nhat</span>
                    <span style={{ fontSize: '12px' }}>&#8594;</span>
                </a>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
                <button
                    onClick={handleLike}
                    className={`flex flex-col items-center gap-1.5 py-3 px-2 transition-all active:scale-95 cursor-pointer ${
                        status.isLiked ? 'bg-red-500/10' : 'hover:bg-red-500/10'
                    }`}
                    style={{ borderRight: '1px solid rgba(255,255,255,0.07)' }}
                >
                    <Heart className={`h-5 w-5 transition-all ${status.isLiked ? 'fill-current text-red-500 scale-110' : 'text-red-400'}`} />
                    <span className={`text-base font-bold leading-none ${status.isLiked ? 'text-red-500' : 'text-white'}`}>
                        {stats.likeCount}
                    </span>
                    <span className={`text-[10px] font-medium ${status.isLiked ? 'text-red-400' : 'text-[#6B5744]'}`}>
                        {status.isLiked ? 'Da thich' : 'Yeu thich'}
                    </span>
                </button>

                <button
                    onClick={handleFollow}
                    className={`flex flex-col items-center gap-1.5 py-3 px-2 transition-all active:scale-95 cursor-pointer ${
                        status.isFollowed ? 'bg-blue-500/10' : 'hover:bg-blue-500/10'
                    }`}
                    style={{ borderRight: '1px solid rgba(255,255,255,0.07)' }}
                >
                    <Bookmark className={`h-5 w-5 transition-all ${status.isFollowed ? 'fill-current text-blue-500 scale-110' : 'text-blue-400'}`} />
                    <span className={`text-base font-bold leading-none ${status.isFollowed ? 'text-blue-500' : 'text-white'}`}>
                        {stats.followCount}
                    </span>
                    <span className={`text-[10px] font-medium ${status.isFollowed ? 'text-blue-400' : 'text-[#6B5744]'}`}>
                        {status.isFollowed ? 'Da theo' : 'Theo doi'}
                    </span>
                </button>

                <button
                    onClick={handleNominate}
                    disabled={nominateLocked}
                    className={`flex flex-col items-center gap-1.5 py-3 px-2 transition-all active:scale-95 ${
                        nominateLocked ? 'bg-amber-500/10 cursor-not-allowed' : 'hover:bg-amber-500/10 cursor-pointer'
                    }`}
                >
                    <Trophy className={`h-5 w-5 ${nominateLocked ? 'text-amber-500 fill-current' : 'text-amber-400'}`} />
                    <span className="text-base font-bold leading-none text-white">{stats.nominationCount}</span>
                    <span className={`text-[10px] font-medium ${nominateLocked ? 'text-amber-400' : 'text-[#6B5744]'}`}>
                        {nominateLocked ? 'Da de cu' : 'De cu'}
                    </span>
                </button>
            </div>
        </div>
    );
}
                </button>
            </div>
        </div>
    );
}
