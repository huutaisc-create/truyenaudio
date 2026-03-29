"use client";

// D:\Webtruyen\webtruyen-app\src\components\story\ReviewButton.tsx

import { useState, useEffect } from "react";
import ReviewModal, {
    ToastPortal,
    useToast,
    getToastType,
    type ReviewSubmitPayload,
} from "./ReviewModal";
import { PenLine, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { checkHasReviewed } from "@/actions/interactions";

type ReviewButtonProps = {
    storyId: string;
    className?: string;
    text?: string;
    currentUser?: any;
    hasReviewed?: boolean;
    onReviewSubmitted?: (review: { rating: number; content: string }) => void;
};

export default function ReviewButton({
    storyId,
    className,
    text = "VIẾT REVIEW",
    currentUser,
    hasReviewed = false,
    onReviewSubmitted,
}: ReviewButtonProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [localHasReviewed, setLocalHasReviewed] = useState(hasReviewed);
    const router = useRouter();

    // Check server khi mount để restore đúng trạng thái sau refresh/login lại
    useEffect(() => {
        if (!currentUser || localHasReviewed) return;
        checkHasReviewed(storyId).then(reviewed => {
            if (reviewed) setLocalHasReviewed(true);
        });
    }, [storyId, currentUser]); // eslint-disable-line react-hooks/exhaustive-deps

    // Toast state sống ở đây — không bị unmount khi modal đóng
    const { toasts, addToast, dismissToast } = useToast();

    const handleClick = () => {
        if (!currentUser) {
            if (confirm("Bạn cần đăng nhập để viết đánh giá. Đăng nhập ngay?")) {
                router.push("/login?callbackUrl=" + window.location.pathname);
            }
            return;
        }
        setIsOpen(true);
    };

    const handleReviewResult = (payload: ReviewSubmitPayload) => {
        if (payload.success) {
            // Cập nhật UI ngay, không cần đợi router.refresh()
            setLocalHasReviewed(true);
            onReviewSubmitted?.({ rating: payload.rating, content: payload.content });
            const msg = payload.creditMessage || "Cảm ơn bạn đã đánh giá!";
            addToast(msg, getToastType(msg));
        } else if (payload.blocked) {
            const msg = payload.creditMessage || "Hãy quay lại vào ngày mai nhé!";
            addToast(msg, 'warning');
            setLocalHasReviewed(true);
        } else {
            const msg = payload.creditMessage || "Gửi đánh giá thất bại.";
            addToast(msg, 'info');
        }
    };

    return (
        <>
            {/* Toast portal — sống cùng ReviewButton, không bị unmount */}
            <ToastPortal toasts={toasts} onDismiss={dismissToast} />

            {localHasReviewed ? (
                <div
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-green-500/20 text-green-700 border border-green-500/30 cursor-default select-none dark:text-green-300"
                    title="Bạn đã đánh giá truyện này"
                >
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    Đã đánh giá
                </div>
            ) : (
                <button
                    onClick={handleClick}
                    className={
                        className ||
                        "text-xs font-bold text-brand-primary bg-orange-50 px-4 py-2 rounded-lg hover:bg-orange-100 transition-all active:scale-95 flex items-center gap-2"
                    }
                >
                    <PenLine className="h-4 w-4" /> {text}
                </button>
            )}

            {/* Modal LUÔN render (không bị conditional unmount) */}
            <ReviewModal
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                storyId={storyId}
                onReviewSubmitted={handleReviewResult}
            />
        </>
    );
}
