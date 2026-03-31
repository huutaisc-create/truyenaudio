"use client";

// D:\Webtruyen\webtruyen-app\src\components\story\ReviewModal.tsx

import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { Star, X, CheckCircle2, Info, Clock } from "lucide-react";
import { submitReview } from "@/actions/stories";

// ── Types export ra ngoài để ReviewButton và StoryRatingClient dùng ──
export type ReviewSubmitPayload = {
    rating: number;
    content: string;
    success: boolean;
    blocked?: boolean;
    creditMessage?: string;
};

export type ToastType = 'success' | 'info' | 'warning';

export interface ToastItem {
    id: number;
    message: string;
    type: ToastType;
}

// ── ToastPortal — render vào document.body bằng React Portal ──
// Export ra để component cha (ReviewButton / StoryRatingClient) giữ state và render
// → toast KHÔNG chết khi modal đóng hay unmount
export function ToastPortal({
    toasts,
    onDismiss,
}: {
    toasts: ToastItem[];
    onDismiss: (id: number) => void;
}) {
    const [domReady, setDomReady] = useState(false);
    useEffect(() => { setDomReady(true); }, []);
    if (!domReady || toasts.length === 0) return null;

    return createPortal(
        <div
            className="fixed top-1/2 -translate-y-1/2 right-4 z-[99999] flex flex-col gap-2 items-end pointer-events-none"
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
                            {toast.type === 'info'    && <Info className="h-4 w-4" />}
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

// ── useToast hook — export để component cha dùng ──
export function useToast() {
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

export function getToastType(message: string): ToastType {
    if (message.startsWith('Bạn nhận được')) return 'success';
    if (message.startsWith('Hãy quay lại'))  return 'warning';
    return 'info';
}

// ── ReviewModal ──
type ReviewModalProps = {
    isOpen: boolean;
    onClose: () => void;
    storyId: string;
    slotsLeft?: number; // số lượt credit còn lại hôm nay (undefined = chưa biết)
    // Trả toàn bộ kết quả về component cha — modal không tự giữ toast
    onReviewSubmitted?: (payload: ReviewSubmitPayload) => void;
};

export default function ReviewModal({
    isOpen,
    onClose,
    storyId,
    slotsLeft,
    onReviewSubmitted,
}: ReviewModalProps) {
    const MIN_LENGTH = 21;

    const [rating, setRating]         = useState(5);   // default 5 sao
    const [content, setContent]       = useState("");
    const [hovered, setHovered]       = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [locked, setLocked]         = useState(false);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [showNoCreditConfirm, setShowNoCreditConfirm] = useState(false);

    const charCount = content.trim().length;

    // Reset mỗi lần mở lại
    useEffect(() => {
        if (isOpen) {
            setRating(5);
            setContent("");
            setHovered(0);
            setIsSubmitting(false);
            setLocked(false);
            setValidationError(null);
            setShowNoCreditConfirm(false);
        }
    }, [isOpen]);

    const displayRating = hovered || rating;

    const handleSubmit = async (skipCreditCheck = false) => {
        // ── Validate client-side trước khi gọi API ──
        const trimmed = content.trim();
        if (trimmed.length === 0) {
            setValidationError('Vui lòng nhập nội dung đánh giá.');
            return;
        }
        if (trimmed.length < MIN_LENGTH) {
            setValidationError(`Cần ít nhất ${MIN_LENGTH} ký tự để gửi đánh giá (hiện tại: ${trimmed.length}).`);
            return;
        }
        // Hết credit hôm nay → hỏi user trước
        if (!skipCreditCheck && slotsLeft === 0) {
            setShowNoCreditConfirm(true);
            return;
        }
        setShowNoCreditConfirm(false);
        setValidationError(null);
        setIsSubmitting(true);
        const result = await submitReview(storyId, rating, content);
        setIsSubmitting(false);

        if (result.success) {
            onReviewSubmitted?.({
                rating,
                content,
                success: true,
                creditMessage: result.creditMessage,
            });
            setLocked(true);
            // Đóng modal sau 1s — KHÔNG refresh vì StoryRatingClient tự update state
            setTimeout(() => { onClose(); }, 1000);
        } else if (result.blocked && result.blockReason === 'SAME_STORY_TODAY') {
            onReviewSubmitted?.({
                rating,
                content,
                success: false,
                blocked: true,
                creditMessage: result.error,
            });
            setLocked(true);
            setTimeout(() => onClose(), 800);
        } else {
            // Lỗi thường — modal vẫn mở, báo cha show toast
            onReviewSubmitted?.({
                rating,
                content,
                success: false,
                blocked: false,
                creditMessage: result.error ?? "Gửi đánh giá thất bại.",
            });
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="relative bg-white dark:bg-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">

                {/* ── Overlay confirm khi hết credit ── */}
                {showNoCreditConfirm && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-zinc-900/95 rounded-2xl px-6 gap-5">
                        <p className="text-sm font-semibold text-white/90 text-center leading-relaxed">
                            Hết lượt cộng credit hôm nay.<br />
                            <span className="text-white/60 font-normal">Bạn vẫn muốn đăng không?</span>
                        </p>
                        <div className="flex gap-3 w-full">
                            <button
                                onClick={() => setShowNoCreditConfirm(false)}
                                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white/60 bg-white/[0.08] hover:bg-white/[0.12] transition-colors"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={() => handleSubmit(true)}
                                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-orange-500 hover:bg-orange-600 transition-colors"
                            >
                                Vẫn đăng
                            </button>
                        </div>
                    </div>
                )}
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Viết Đánh Giá</h3>
                    <button
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="p-2 -mr-2 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-full disabled:opacity-40"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="space-y-6">
                    {/* Stars — luôn hiện, default 5 sao */}
                    <div className="flex flex-col items-center gap-2">
                        <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                            {`${displayRating}/5 sao`}
                        </span>
                        <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map(star => (
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
                            {`${displayRating}/5`}
                        </span>
                    </div>

                    <div className="space-y-1.5">
                        <textarea
                            value={content}
                            onChange={e => { setContent(e.target.value); setValidationError(null); }}
                            placeholder="Chia sẻ cảm nghĩ của bạn..."
                            disabled={locked}
                            className={`w-full h-32 p-4 rounded-xl border bg-gray-50 dark:bg-zinc-900 focus:ring-2 focus:outline-none resize-none disabled:opacity-60 transition-colors ${
                                validationError
                                    ? 'border-red-400 focus:ring-red-400'
                                    : charCount > 0 && charCount < MIN_LENGTH
                                        ? 'border-orange-400 focus:ring-orange-400'
                                        : 'border-gray-200 dark:border-zinc-700 focus:ring-orange-500'
                            }`}
                        />
                        {/* Character counter */}
                        <p className={`text-xs ${
                            locked
                                ? 'text-green-500'
                                : charCount === 0
                                    ? 'text-gray-400'
                                    : charCount < MIN_LENGTH
                                        ? 'text-orange-400'
                                        : 'text-green-500'
                        }`}>
                            {locked
                                ? '✓ Đánh giá đã được lưu'
                                : charCount === 0
                                    ? `Tối thiểu ${MIN_LENGTH} ký tự · hơn 20 ký tự để nhận +0.2 credit`
                                    : charCount < MIN_LENGTH
                                        ? `${charCount}/${MIN_LENGTH} ký tự · Cần thêm ${MIN_LENGTH - charCount} ký tự nữa`
                                        : `${charCount} ký tự ✓ · Đủ điều kiện nhận +0.2 credit`
                            }
                        </p>
                        {/* Validation error */}
                        {validationError && (
                            <p className="text-xs text-red-400 flex items-center gap-1">
                                <span>⚠</span> {validationError}
                            </p>
                        )}
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="flex-1 py-3 text-sm font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-700 dark:text-white dark:hover:bg-zinc-600 rounded-xl transition-colors disabled:opacity-50"
                        >
                            Hủy
                        </button>
                        {!locked && (
                            <button
                                onClick={() => handleSubmit()}
                                disabled={isSubmitting}
                                className={`flex-1 py-3 text-sm font-bold text-white rounded-xl shadow-lg transition-all active:scale-95 disabled:cursor-not-allowed ${
                                    charCount >= MIN_LENGTH
                                        ? 'bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 shadow-orange-500/20'
                                        : 'bg-gradient-to-r from-orange-500/50 to-red-600/50 cursor-not-allowed'
                                } disabled:opacity-70`}
                            >
                                {isSubmitting ? "Đang gửi..." : "Gửi Đánh Giá"}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
