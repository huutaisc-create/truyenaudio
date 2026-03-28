"use client";

import { useState } from "react";
import { Star, X, CheckCircle2 } from "lucide-react";
import { submitReview } from "@/actions/stories";
import { useRouter } from "next/navigation";

type ReviewModalProps = {
    isOpen: boolean;
    onClose: () => void;
    storyId: string;
    // Callback để hiện review ngay mà không cần router.refresh()
    onReviewSubmitted?: (review: { rating: number; content: string }) => void;
}

export default function ReviewModal({ isOpen, onClose, storyId, onReviewSubmitted }: ReviewModalProps) {
    const [rating, setRating] = useState(0);  // 0 = chưa chọn, vẫn hiện sao
    const [content, setContent] = useState("");
    const [hovered, setHovered] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [locked, setLocked] = useState(false); // khóa tới 0h
    const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
    const router = useRouter();

    if (!isOpen) return null;

    const showToast = (msg: string, ok: boolean) => {
        setToast({ msg, ok });
        setTimeout(() => setToast(null), ok ? 5000 : 3500);
    };

    const displayRating = hovered || rating; // 0 = không fill, vẫn hiện outline

    const handleSubmit = async () => {
        if (rating === 0) {
            showToast("Vui lòng chọn số sao trước khi gửi.", false);
            return;
        }
        setIsSubmitting(true);
        const result = await submitReview(storyId, rating, content);
        setIsSubmitting(false);

        if (result.success) {
            // Hiện review ngay lập tức qua callback (không chờ router.refresh)
            onReviewSubmitted?.({ rating, content });
            const msg = result.creditMessage
                ? `${result.creditMessage}`
                : "Cảm ơn bạn đã đánh giá!";
            showToast(msg, true);
            setLocked(true);
            // Đóng modal sau 2s
            setTimeout(() => { onClose(); router.refresh(); }, 2000);
        } else if (result.blocked) {
            showToast(result.error || "Đã hết lượt đánh giá hôm nay.", false);
            setLocked(true);
        } else {
            showToast(result.error || "Gửi đánh giá thất bại.", false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Viết Đánh Giá</h3>
                    <button onClick={onClose} className="p-2 -mr-2 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-full">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Toast inline trong modal */}
                {toast && (
                    <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium border mb-4 animate-in fade-in slide-in-from-top-2 duration-300 ${
                        toast.ok
                            ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/30 dark:border-green-700/50 dark:text-green-300'
                            : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/30 dark:border-red-700/50 dark:text-red-300'
                    }`} role="status" aria-live="polite">
                        {toast.ok && <CheckCircle2 className="h-4 w-4 shrink-0" />}
                        <span className="flex-1">{toast.msg}</span>
                        <button onClick={() => setToast(null)} className="shrink-0 opacity-60 hover:opacity-100">
                            <X className="h-3.5 w-3.5" />
                        </button>
                    </div>
                )}

                <div className="space-y-6">
                    {/* Stars — luôn hiện dù rating=0 */}
                    <div className="flex flex-col items-center gap-2">
                        <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                            {rating === 0 ? "Chọn số sao" : `${rating}/5 sao`}
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
                            placeholder="Chia sẻ cảm nghĩ của bạn (≥20 ký tự để nhận +0.2 credit)..."
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
    );
}


