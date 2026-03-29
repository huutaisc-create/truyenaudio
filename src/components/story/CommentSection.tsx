"use client";

// D:\Webtruyen\webtruyen-app\src\components\story\CommentSection.tsx

import { useState, useEffect, useRef, useCallback } from "react";
import { Heart, CornerDownRight, Send, Loader2, Trash2, X, CheckCircle2, Info, Clock } from "lucide-react";
import Image from "next/image";

type CommentUser = {
    id: string;
    name: string;
    image: string | null;
    role: string;
};

type Comment = {
    id: string;
    content: string;
    likeCount: number;
    isLiked: boolean;
    createdAt: string;
    user: CommentUser;
};

type CommentSectionProps = {
    storySlug: string;
    currentUser: {
        id: string;
        name: string;
        image?: string | null;
        role?: string;
    } | null;
};

function timeAgo(dateStr: string) {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return "Vừa xong";
    if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
    if (diff < 2592000) return `${Math.floor(diff / 86400)} ngày trước`;
    return new Date(dateStr).toLocaleDateString("vi-VN");
}

function Avatar({ name, image, size = 38 }: { name: string; image?: string | null; size?: number }) {
    const colors = [
        "linear-gradient(135deg,#E8580A,#F5A623)",
        "linear-gradient(135deg,#667eea,#764ba2)",
        "linear-gradient(135deg,#f093fb,#f5576c)",
        "linear-gradient(135deg,#4facfe,#00f2fe)",
        "linear-gradient(135deg,#43e97b,#38f9d7)",
    ];
    const color = colors[name.charCodeAt(0) % colors.length];
    if (image) {
        return (
            <Image
                src={image}
                alt={`Ảnh đại diện của ${name}`}
                width={size}
                height={size}
                className="rounded-full object-cover shrink-0"
                style={{ borderRadius: "50%", width: size, height: size, minWidth: size }}
            />
        );
    }
    return (
        <div
            className="rounded-full flex items-center justify-center shrink-0 text-white font-black"
            style={{ width: size, height: size, background: color, fontSize: size * 0.38 }}
            aria-label={name}
        >
            {name.charAt(0).toUpperCase()}
        </div>
    );
}

// ── Toast component — fixed bottom-right, tồn tại 10s ──
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
        // Tự động xóa sau 10s
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

export default function CommentSection({ storySlug, currentUser }: CommentSectionProps) {
    const [comments, setComments] = useState<Comment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [nextCursor, setNextCursor] = useState<string | null>(null);

    const [content, setContent] = useState("");
    const [isSending, setIsSending] = useState(false);

    const { toasts, addToast, dismissToast } = useToast();

    const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);

    // Lock state: đã bình luận truyện này hôm nay
    const [commentLocked, setCommentLocked] = useState(false);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const topRef = useRef<HTMLDivElement>(null);

    // ── Fetch lần đầu ──────────────────────────────────────────
    useEffect(() => {
        const fetchComments = async () => {
            setIsLoading(true);
            try {
                const res = await fetch(`/api/stories/${storySlug}/comments?limit=20`);
                if (res.ok) {
                    const json = await res.json();
                    if (json.success) {
                        setComments(json.data);
                        setHasMore(json.hasMore);
                        setNextCursor(json.nextCursor);
                    }
                }
            } catch (e) {
                console.error(e);
            } finally {
                setIsLoading(false);
            }
        };
        fetchComments();
    }, [storySlug]);

    // ── Load more ──────────────────────────────────────────────
    const handleLoadMore = useCallback(async () => {
        if (!hasMore || isLoadingMore || !nextCursor) return;
        setIsLoadingMore(true);
        try {
            const res = await fetch(
                `/api/stories/${storySlug}/comments?limit=20&after=${nextCursor}`
            );
            if (res.ok) {
                const json = await res.json();
                if (json.success) {
                    setComments(prev => [...json.data, ...prev]);
                    setHasMore(json.hasMore);
                    setNextCursor(json.nextCursor);
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoadingMore(false);
        }
    }, [hasMore, isLoadingMore, nextCursor, storySlug]);

    // ── Gửi comment ───────────────────────────────────────────
    const handleSend = async () => {
        if (!content.trim() || isSending || commentLocked) return;
        if (!currentUser) {
            window.location.href = "/login?callbackUrl=" + window.location.pathname;
            return;
        }

        const body = replyTo
            ? `@${replyTo.name} ${content.trim()}`
            : content.trim();

        setIsSending(true);
        try {
            const res = await fetch(`/api/stories/${storySlug}/comments`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: body }),
            });

            const json = await res.json();

            // Đã bình luận truyện này hôm nay → không lưu, toast + lock
            if (json.blockReason === 'SAME_STORY_TODAY') {
                addToast(json.creditMessage, 'warning');
                setCommentLocked(true);
                return;
            }

            // Lỗi validation (content trống, < 21 ký tự, ...)
            if (!res.ok && !json.success) {
                addToast(json.error || "Gửi bình luận thất bại", 'info');
                return;
            }

            if (json.success) {
                // Thêm comment vào danh sách
                setComments(prev => [...prev, json.data]);
                setContent("");
                setReplyTo(null);
                textareaRef.current?.focus();
                setTimeout(() => {
                    window.scrollBy({ top: 999, behavior: "smooth" });
                }, 100);

                // Hiện toast credit
                if (json.creditMessage) {
                    addToast(json.creditMessage, getToastType(json.creditMessage));
                }

                // Lock truyện này tới 0h (server trả cooldownSeconds = giây tới 0h)
                if (json.cooldownSeconds && json.cooldownSeconds > 60) {
                    setCommentLocked(true);
                }
            } else {
                addToast(json.error || "Gửi bình luận thất bại", 'info');
            }
        } catch {
            addToast("Lỗi kết nối, thử lại sau", 'info');
        } finally {
            setIsSending(false);
        }
    };

    // ── Like comment ──────────────────────────────────────────
    const handleLike = async (commentId: string) => {
        if (!currentUser) {
            window.location.href = "/login?callbackUrl=" + window.location.pathname;
            return;
        }
        setComments(prev =>
            prev.map(c =>
                c.id === commentId
                    ? { ...c, isLiked: !c.isLiked, likeCount: c.likeCount + (c.isLiked ? -1 : 1) }
                    : c
            )
        );
        try {
            await fetch(`/api/stories/${storySlug}/comments/${commentId}/like`, { method: "POST" });
        } catch {
            setComments(prev =>
                prev.map(c =>
                    c.id === commentId
                        ? { ...c, isLiked: !c.isLiked, likeCount: c.likeCount + (c.isLiked ? -1 : 1) }
                        : c
                )
            );
        }
    };

    // ── Delete comment ────────────────────────────────────────
    const handleDelete = async (commentId: string) => {
        if (!confirm("Xóa bình luận này?")) return;
        try {
            const res = await fetch(`/api/stories/${storySlug}/comments/${commentId}`, {
                method: "DELETE",
            });
            if (res.ok) {
                setComments(prev => prev.filter(c => c.id !== commentId));
            }
        } catch {
            addToast("Xóa thất bại, thử lại sau", 'info');
        }
    };

    const canDelete = (comment: Comment) =>
        currentUser &&
        (currentUser.id === comment.user.id || currentUser.role === "ADMIN");

    const handleReply = (comment: Comment) => {
        if (!currentUser) {
            window.location.href = "/login?callbackUrl=" + window.location.pathname;
            return;
        }
        setReplyTo({ id: comment.id, name: comment.user.name });
        setContent("");
        textareaRef.current?.focus();
        textareaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    };

    return (
        <section
            aria-label="Bình luận"
            className="bg-warm-card rounded-2xl border border-warm-border-soft shadow-sm p-6 md:p-8"
        >
            {/* Toast portal — fixed bottom-right */}
            <ToastPortal toasts={toasts} onDismiss={dismissToast} />

            <h2 className="font-bold text-base mb-5 text-warm-ink flex items-center gap-2.5">
                <span className="w-1 h-5 rounded-sm bg-warm-primary shrink-0" aria-hidden="true" />
                Bình luận
                {comments.length > 0 && (
                    <span className="text-xs font-semibold text-warm-ink-soft ml-1">
                        ({comments.length})
                    </span>
                )}
            </h2>

            {/* Load more button */}
            {hasMore && (
                <div ref={topRef} className="flex justify-center mb-4">
                    <button
                        onClick={handleLoadMore}
                        disabled={isLoadingMore}
                        className="text-sm text-warm-primary hover:underline flex items-center gap-1.5 disabled:opacity-50"
                    >
                        {isLoadingMore
                            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang tải...</>
                            : "Xem bình luận cũ hơn"}
                    </button>
                </div>
            )}

            {/* Comment list */}
            {isLoading ? (
                <div className="flex justify-center py-8" role="status" aria-label="Đang tải bình luận...">
                    <Loader2 className="h-5 w-5 animate-spin text-warm-ink-light" aria-hidden="true" />
                </div>
            ) : comments.length === 0 ? (
                <p className="text-base italic text-warm-ink-soft text-center py-6">
                    Chưa có bình luận nào. Hãy là người đầu tiên! 💬
                </p>
            ) : (
                <ol className="space-y-3 mb-6" aria-label="Danh sách bình luận">
                    {comments.map(comment => (
                        <li
                            key={comment.id}
                            className="flex gap-3 p-4 rounded-xl bg-warm-card border border-warm-border"
                        >
                            <Avatar name={comment.user.name} image={comment.user.image} size={36} />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    <span className="text-base font-bold text-warm-ink">
                                        {comment.user.name}
                                    </span>
                                    {comment.user.role === "ADMIN" && (
                                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-warm-primary text-white uppercase tracking-wider">
                                            Admin
                                        </span>
                                    )}
                                </div>
                                <p className="text-base text-warm-ink leading-relaxed mb-2 whitespace-pre-wrap">
                                    {comment.content}
                                </p>
                                <div className="flex items-center gap-4 text-sm text-warm-ink-soft flex-wrap">
                                    <time dateTime={comment.createdAt}>{timeAgo(comment.createdAt)}</time>

                                    <button
                                        onClick={() => handleLike(comment.id)}
                                        aria-label={`${comment.isLiked ? "Bỏ thích" : "Thích"} bình luận của ${comment.user.name}`}
                                        aria-pressed={comment.isLiked}
                                        className={`flex items-center gap-1 transition-colors ${comment.isLiked ? "text-red-500" : "hover:text-red-400"}`}
                                    >
                                        <Heart className={`h-3.5 w-3.5 ${comment.isLiked ? "fill-current" : ""}`} aria-hidden="true" />
                                        <span>{comment.likeCount > 0 ? comment.likeCount : "Thích"}</span>
                                    </button>

                                    <button
                                        onClick={() => handleReply(comment)}
                                        className="flex items-center gap-1 hover:text-warm-primary transition-colors"
                                        aria-label={`Trả lời bình luận của ${comment.user.name}`}
                                    >
                                        <CornerDownRight className="h-3.5 w-3.5" aria-hidden="true" />
                                        Trả lời
                                    </button>

                                    {canDelete(comment) && (
                                        <button
                                            onClick={() => handleDelete(comment.id)}
                                            className="flex items-center gap-1 hover:text-red-500 transition-colors ml-auto"
                                            aria-label={`Xóa bình luận của ${comment.user.name}`}
                                        >
                                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </li>
                    ))}
                </ol>
            )}

            {/* Input box */}
            <div className="flex gap-3">
                <Avatar name={currentUser?.name || "U"} image={currentUser?.image} size={38} />
                <div className="flex-1 flex flex-col gap-2">
                    {/* Reply badge */}
                    {replyTo && (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-warm-bg border border-warm-border text-sm text-warm-ink-soft">
                            <CornerDownRight className="h-3.5 w-3.5 shrink-0" />
                            <span>Trả lời <strong className="text-warm-ink">{replyTo.name}</strong></span>
                            <button
                                onClick={() => setReplyTo(null)}
                                className="ml-auto hover:text-warm-ink transition-colors"
                                aria-label="Hủy trả lời"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    )}

                    <textarea
                        ref={textareaRef}
                        value={content}
                        onChange={e => setContent(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter" && e.ctrlKey) handleSend(); }}
                        placeholder={
                            !currentUser
                                ? "Đăng nhập để bình luận..."
                                : commentLocked
                                ? "Bạn đã bình luận truyện này hôm nay. Quay lại sau 0h nhé!"
                                : replyTo
                                ? `Trả lời ${replyTo.name}...`
                                : "Chia sẻ cảm nhận của bạn (cần hơn 20 ký tự để nhận +0.2 credit)..."
                        }
                        rows={3}
                        aria-label="Nội dung bình luận"
                        disabled={!currentUser || commentLocked}
                        className="w-full px-4 py-3 text-sm rounded-xl resize-none outline-none transition-all bg-warm-bg border border-warm-border text-warm-ink placeholder:text-warm-ink-soft focus:border-warm-primary disabled:opacity-60"
                    />
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-xs text-warm-ink-soft" aria-hidden="true">
                            {commentLocked
                                ? "🔒 Đã bình luận truyện này hôm nay · Mở lại sau 0h"
                                : "Ctrl+Enter để gửi · hơn 20 ký tự để nhận credit"}
                        </span>
                        <button
                            onClick={handleSend}
                            disabled={isSending || !content.trim() || commentLocked}
                            aria-label={
                                commentLocked
                                    ? "Đã bình luận truyện này hôm nay"
                                    : isSending ? "Đang gửi bình luận..." : "Gửi bình luận"
                            }
                            className="flex items-center gap-2 px-5 py-2 rounded-xl text-base font-bold text-white bg-warm-primary hover:bg-warm-primary-soft transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSending
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                                : <Send className="h-3.5 w-3.5" aria-hidden="true" />
                            }
                            {isSending
                                ? "Đang gửi..."
                                : commentLocked
                                ? "🔒 Đã bình luận hôm nay"
                                : replyTo ? "Trả lời" : "Gửi bình luận"
                            }
                        </button>
                    </div>
                </div>
            </div>
        </section>
    );
}
