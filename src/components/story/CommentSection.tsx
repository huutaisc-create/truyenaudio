"use client";

import { useState, useEffect, useRef } from "react";
import { Heart, CornerDownRight, Send, Loader2 } from "lucide-react";

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
        return <img src={image} alt={name} className="rounded-full object-cover shrink-0"
            style={{ width: size, height: size }} />;
    }
    return (
        <div className="rounded-full flex items-center justify-center shrink-0 text-white font-black"
            style={{ width: size, height: size, background: color, fontSize: size * 0.38 }}>
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

    // Load comments
    useEffect(() => {
        const fetchComments = async () => {
            try {
                const res = await fetch(`/api/chat/${storySlug}/messages`);
                if (res.ok) {
                    const data = await res.json();
                    setComments(data);
                    // Init fake like counts
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
        <div className="bg-warm-card rounded-2xl border border-warm-border-soft shadow-sm p-6 md:p-8">
            <h2 className="font-bold text-base mb-5 text-warm-ink flex items-center gap-2.5">
                <span className="w-1 h-5 rounded-sm bg-warm-primary shrink-0"></span>
                Bình luận
                {comments.length > 0 && (
                    <span className="text-xs font-semibold text-warm-ink-light ml-1">({comments.length})</span>
                )}
            </h2>

            {/* Input box */}
            <div className="flex gap-3 mb-6">
                <Avatar
                    name={currentUser?.name || "U"}
                    image={currentUser?.image}
                    size={38}
                />
                <div className="flex-1 flex flex-col gap-2">
                    <textarea
                        ref={textareaRef}
                        value={content}
                        onChange={e => setContent(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSend(); }}
                        placeholder={currentUser ? "Chia sẻ cảm nhận của bạn về truyện..." : "Đăng nhập để bình luận..."}
                        rows={3}
                        className="w-full px-4 py-3 text-sm rounded-xl resize-none outline-none transition-all bg-warm-bg border border-warm-border text-warm-ink-mid placeholder:text-warm-ink-light focus:border-warm-primary"
                    />
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] text-warm-ink-light">Ctrl+Enter để gửi</span>
                        <button
                            onClick={handleSend}
                            disabled={isSending || !content.trim()}
                            className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold text-white bg-warm-primary hover:bg-warm-primary-soft transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSending
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <Send className="h-3.5 w-3.5" />
                            }
                            Gửi bình luận
                        </button>
                    </div>
                </div>
            </div>

            {/* Comment list */}
            {isLoading ? (
                <div className="flex justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-warm-ink-light" />
                </div>
            ) : comments.length === 0 ? (
                <p className="text-sm italic text-warm-ink-light text-center py-6">
                    Chưa có bình luận nào. Hãy là người đầu tiên! 💬
                </p>
            ) : (
                <div className="space-y-3">
                    {comments.map(comment => (
                        <div key={comment.id}
                            className="flex gap-3 p-4 rounded-xl bg-warm-bg border border-warm-border-soft">
                            <Avatar name={comment.user.name} image={comment.user.image} size={36} />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    <span className="text-sm font-bold text-warm-ink">{comment.user.name}</span>
                                    {comment.user.role === 'ADMIN' && (
                                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-warm-primary text-white uppercase tracking-wider">Admin</span>
                                    )}
                                </div>
                                <p className="text-sm text-warm-ink-mid leading-relaxed mb-2">{comment.content}</p>
                                <div className="flex items-center gap-4 text-xs text-warm-ink-light">
                                    <span>{timeAgo(comment.createdAt)}</span>
                                    <button
                                        onClick={() => handleLike(comment.id)}
                                        className={`flex items-center gap-1 transition-colors ${likedIds.has(comment.id) ? 'text-red-500' : 'hover:text-red-400'}`}
                                    >
                                        <Heart className={`h-3.5 w-3.5 ${likedIds.has(comment.id) ? 'fill-current' : ''}`} />
                                        {likeCounts[comment.id] || 0}
                                    </button>
                                    <button className="flex items-center gap-1 hover:text-warm-primary transition-colors">
                                        <CornerDownRight className="h-3.5 w-3.5" />
                                        Trả lời
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
