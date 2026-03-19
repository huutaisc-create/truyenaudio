"use client";

import { useState, useEffect, useRef } from "react";
import { Heart, CornerDownRight, Send, Loader2 } from "lucide-react";
import Image from "next/image"; // FIX LCP

type Comment = {
    id: string;
    content: string;
    createdAt: string;
    user: {
        id: string;
        name: string;
        image: string | null;
        role: string;
    };
};

type CommentSectionProps = {
    storySlug: string;
    currentUser: {
        id: string;
        name: string;
        image?: string | null;
    } | null;
};

function timeAgo(dateStr: string) {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return "Vừa xong";
    if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
    if (diff < 2592000) return `${Math.floor(diff / 86400)} ngày trước`;
    return new Date(dateStr).toLocaleDateString('vi-VN');
}

function Avatar({ name, image, size = 38 }: { name: string; image?: string | null; size?: number }) {
    const colors = [
        'linear-gradient(135deg,#E8580A,#F5A623)',
        'linear-gradient(135deg,#667eea,#764ba2)',
        'linear-gradient(135deg,#f093fb,#f5576c)',
        'linear-gradient(135deg,#4facfe,#00f2fe)',
        'linear-gradient(135deg,#43e97b,#38f9d7)',
    ];
    const color = colors[name.charCodeAt(0) % colors.length];

    if (image) {
        return (
            // FIX LCP: next/image thay <img>
            <Image
                src={image}
                alt={`Ảnh đại diện của ${name}`} // FIX A11Y: alt mô tả rõ
                width={size}
                height={size}
                className="rounded-full object-cover shrink-0"
            />
        );
    }
    return (
        <div
            className="rounded-full flex items-center justify-center shrink-0 text-white font-black"
            style={{ width: size, height: size, background: color, fontSize: size * 0.38 }}
            aria-label={name} // FIX A11Y: tên user cho screen reader
        >
            {name.charAt(0).toUpperCase()}
        </div>
    );
}

export default function CommentSection({ storySlug, currentUser }: CommentSectionProps) {
    const [comments, setComments] = useState<Comment[]>([]);
    const [content, setContent] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
    const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        const fetchComments = async () => {
            try {
                const res = await fetch(`/api/chat/${storySlug}/messages`);
                if (res.ok) {
                    const data = await res.json();
                    setComments(data);
                    const counts: Record<string, number> = {};
                    data.forEach((c: Comment) => { counts[c.id] = Math.floor(Math.random() * 20); });
                    setLikeCounts(counts);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setIsLoading(false);
            }
        };
        fetchComments();
    }, [storySlug]);

    const handleSend = async () => {
        if (!content.trim() || isSending) return;
        if (!currentUser) {
            if (confirm("Bạn cần đăng nhập để bình luận. Đăng nhập ngay?")) {
                window.location.href = "/login?callbackUrl=" + window.location.pathname;
            }
            return;
        }

        setIsSending(true);
        try {
            const res = await fetch(`/api/chat/${storySlug}/messages`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: content.trim() }),
            });

            if (res.ok) {
                const newComment = await res.json();
                setComments(prev => [...prev, newComment]);
                setLikeCounts(prev => ({ ...prev, [newComment.id]: 0 }));
                setContent("");
                textareaRef.current?.focus();
            } else {
                const err = await res.json();
                alert(err.error || "Gửi bình luận thất bại");
            }
        } catch (e) {
            alert("Lỗi kết nối, thử lại sau");
        } finally {
            setIsSending(false);
        }
    };

    const handleLike = (id: string) => {
        if (!currentUser) return;
        setLikedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
                setLikeCounts(c => ({ ...c, [id]: (c[id] || 1) - 1 }));
            } else {
                next.add(id);
                setLikeCounts(c => ({ ...c, [id]: (c[id] || 0) + 1 }));
            }
            return next;
        });
    };

    return (
        <section
            aria-label="Bình luận" // FIX A11Y
            className="bg-warm-card rounded-2xl border border-warm-border-soft shadow-sm p-6 md:p-8"
        >
            <h2 className="font-bold text-base mb-5 text-warm-ink flex items-center gap-2.5">
                <span className="w-1 h-5 rounded-sm bg-warm-primary shrink-0" aria-hidden="true"></span>
                Bình luận
                {comments.length > 0 && (
                    <span className="text-xs font-semibold text-warm-ink-soft ml-1">({comments.length})</span>
                )}
            </h2>

            {/* Input box */}
            <div className="flex gap-3 mb-6">
                <Avatar name={currentUser?.name || "U"} image={currentUser?.image} size={38} />
                <div className="flex-1 flex flex-col gap-2">
                    <textarea
                        ref={textareaRef}
                        value={content}
                        onChange={e => setContent(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSend(); }}
                        placeholder={currentUser ? "Chia sẻ cảm nhận của bạn về truyện..." : "Đăng nhập để bình luận..."}
                        rows={3}
                        aria-label="Nội dung bình luận" // FIX A11Y
                        disabled={!currentUser}
                        className="w-full px-4 py-3 text-sm rounded-xl resize-none outline-none transition-all bg-warm-bg border border-warm-border text-warm-ink placeholder:text-warm-ink-soft focus:border-warm-primary disabled:opacity-60"
                    />
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] text-warm-ink-soft" aria-hidden="true">Ctrl+Enter để gửi</span>
                        <button
                            onClick={handleSend}
                            disabled={isSending || !content.trim()}
                            aria-label={isSending ? "Đang gửi bình luận..." : "Gửi bình luận"} // FIX A11Y
                            className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold text-white bg-warm-primary hover:bg-warm-primary-soft transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSending
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                                : <Send className="h-3.5 w-3.5" aria-hidden="true" />
                            }
                            Gửi bình luận
                        </button>
                    </div>
                </div>
            </div>

            {/* Comment list */}
            {isLoading ? (
                <div className="flex justify-center py-8" role="status" aria-label="Đang tải bình luận...">
                    <Loader2 className="h-5 w-5 animate-spin text-warm-ink-light" aria-hidden="true" />
                </div>
            ) : comments.length === 0 ? (
                <p className="text-sm italic text-warm-ink-soft text-center py-6">
                    Chưa có bình luận nào. Hãy là người đầu tiên! 💬
                </p>
            ) : (
                <ol className="space-y-3" aria-label="Danh sách bình luận"> {/* FIX A11Y: ol thay div */}
                    {comments.map(comment => (
                        <li key={comment.id}
                            className="flex gap-3 p-4 rounded-xl bg-warm-card border border-warm-border"
                        >
                            <Avatar name={comment.user.name} image={comment.user.image} size={36} />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    <span className="text-sm font-bold text-warm-ink">{comment.user.name}</span>
                                    {comment.user.role === 'ADMIN' && (
                                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-warm-primary text-white uppercase tracking-wider">Admin</span>
                                    )}
                                </div>
                                <p className="text-sm text-warm-ink leading-relaxed mb-2">{comment.content}</p>
                                <div className="flex items-center gap-4 text-xs text-warm-ink-soft">
                                    <time dateTime={comment.createdAt}>{timeAgo(comment.createdAt)}</time> {/* FIX A11Y: <time> */}
                                    <button
                                        onClick={() => handleLike(comment.id)}
                                        aria-label={`${likedIds.has(comment.id) ? 'Bỏ thích' : 'Thích'} bình luận của ${comment.user.name}. ${likeCounts[comment.id] || 0} lượt thích`}
                                        aria-pressed={likedIds.has(comment.id)} // FIX A11Y
                                        className={`flex items-center gap-1 transition-colors ${likedIds.has(comment.id) ? 'text-red-500' : 'hover:text-red-400'}`}
                                    >
                                        <Heart className={`h-3.5 w-3.5 ${likedIds.has(comment.id) ? 'fill-current' : ''}`} aria-hidden="true" />
                                        <span aria-hidden="true">{likeCounts[comment.id] || 0}</span>
                                    </button>
                                    <button
                                        className="flex items-center gap-1 hover:text-warm-primary transition-colors"
                                        aria-label={`Trả lời bình luận của ${comment.user.name}`} // FIX A11Y
                                    >
                                        <CornerDownRight className="h-3.5 w-3.5" aria-hidden="true" />
                                        Trả lời
                                    </button>
                                </div>
                            </div>
                        </li>
                    ))}
                </ol>
            )}
        </section>
    );
}
