"use client";

// D:\Webtruyen\webtruyen-app\src\components\story\ReviewModal.tsx

import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { Star, X, CheckCircle2, Info, Clock } from "lucide-react";
import { submitReview } from "@/actions/stories";
import { useRouter } from "next/navigation";

type ReviewModalProps = {
    isOpen: boolean;
    onClose: () => void;
    storyId: string;
    onReviewSubmitted?: (review: { rating: number; content: string }) => void;
}

// ── Toast types ──
type ToastType = 'success' | 'info' | 'warning';

interface ToastItem {
    id: number;
    message: string;
    type: ToastType;
}

// ── Toast portal — dùng React Portal để render thẳng vào document.body,
//    tránh bị modal overlay z-index che khuất, và sống độc lập với modal ──
function ToastPortal({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);
    if (!mounted || toasts.length === 0) return null;

    return createPortal(
        <div
            className="fixed bottom-6 right-4 z-[99999] flex flex-col gap-2 items-end pointer-events-none"
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
        </div>,
        document.body
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

export default function ReviewModal({ isOpen, onClose, storyId, onReviewSubmitted }: ReviewModalProps) {
    // [FIX #1] Mặc định 5 sao thay vì 0
    const [rating, setRating] = useState(5);
    const [content, setContent] = useState("");
    const [hovered, setHovered] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [locked, setLocked] = useState(false);
    // [FIX #2] Toast sống ngoài modal — không phụ thuộc vào isOpen
    const { toasts, addToast, dismissToast } = useToast();
    const router = useRouter();

    // Reset state mỗi khi modal được mở lại
    useEffect(() => {
        if (isOpen) {
            setRating(5);
            setContent("");
            setHovered(0);
            setLocked(false);
        }
    }, [isOpen]);

    const displayRating = hovered || rating;

    const handleSubmit = async () => {
        if (rating === 0) {
            addToast("Vui lòng chọn số sao trước khi gửi.", 'info');
            return;
        }
        setIsSubmitting(true);
        const result = await submitReview(storyId, rating, content);
        setIsSubmitting(false);

        if (result.success) {
            // [FIX #3] Gọi callback cập nhật UI cha NGAY LẬP TỨC
            onReviewSubmitted?.({ rating, content });
            const msg = result.creditMessage || "Cảm ơn bạn đã đánh giá!";
            // Toast hiện TRƯỚC khi đóng modal
            addToast(msg, getToastType(msg));
            setLocked(true);
            // Đóng modal sau 2.5s, toast vẫn còn sống (10s) nhờ React Portal
            setTimeout(() => { onClose(); router.refresh(); }, 2500);
        } else if (result.blocked && result.blockReason === 'SAME_STORY_TODAY') {
            addToast(result.error || "Hãy quay lại vào ngày mai nhé!", 'warning');
            setLocked(true);
        } else {
            addToast(result.error || "Gửi đánh giá thất bại.", 'info');
        }
    };

    // [FIX #2] ToastPortal render ở đây — độc lập với if (!isOpen) bên dưới
    // Nó dùng React.createPortal nên sẽ mount vào document.body, không bị
    // modal overlay hay isOpen=false ảnh hưởng
    return (
        <>
            {/* Toast luôn render (kể cả khi modal đã đóng) nhờ Portal */}
            <ToastPortal toasts={toasts} onDismiss={dismissToast} />

            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Viết Đánh Giá</h3>
                            <button onClick={onClose} className="p-2 -mr-2 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-full">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="space-y-6">
                            {/* Stars */}
                            <div className="flex flex-col items-center gap-2">
                                <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                                    {/* [FIX #1] Luôn hiện số sao vì mặc định là 5 */}
                                    {`${rating}/5 sao`}
                                </span>
                                <div className="flex gap-2">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <button
                                            key={star}
                                            type="button"
                                            onMouseEnter={() => setHovered(star)}
                                            onMouseLeave={() => setHovered(0)}
                                            onClick={() => setRating(star)}
                                            disabled={locked}
                                            className="p-1 transition-transform hover:scale-110 active:scale-95 focus:outline-none disabled:cursor-not-allowed"
                                        >
                                            <Star
                                                className={`h-8 w-8 transition-colors ${
                                                    star <= displayRating
                                                        ? "fill-orange-400 text-orange-400"
                                                        : "text-zinc-300 dark:text-zinc-600"
                                                }`}
                                            />
                                        </button>
                                    ))}
                                </div>
                                <span className="text-2xl font-black text-orange-500">
                                    {displayRating > 0 ? `${displayRating}/5` : "—/5"}
                                </span>
                            </div>

                            <div>
                                <textarea
                                    value={content}
                                    onChange={(e) => setContent(e.target.value)}
                                    placeholder="Chia sẻ cảm nghĩ của bạn (hơn 20 ký tự để nhận +0.2 credit)..."
                                    disabled={locked}
                                    className="w-full h-32 p-4 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 focus:ring-2 focus:ring-orange-500 focus:outline-none resize-none disabled:opacity-60"
                                />
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={onClose}
                                    className="flex-1 py-3 text-sm font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-700 dark:text-white dark:hover:bg-zinc-600 rounded-xl transition-colors"
                                >
                                    {locked ? "Đóng" : "Hủy"}
                                </button>
                                {!locked && (
                                    <button
                                        onClick={handleSubmit}
                                        disabled={isSubmitting || rating === 0}
                                        className="flex-1 py-3 text-sm font-bold text-white bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 rounded-xl shadow-lg shadow-orange-500/20 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                                    >
                                        {isSubmitting ? "Đang gửi..." : "Gửi Đánh Giá"}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
