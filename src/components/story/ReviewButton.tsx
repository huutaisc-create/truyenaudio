"use client";

// D:\Webtruyen\webtruyen-app\src\components\story\ReviewButton.tsx

import { useState } from "react";
import ReviewModal from "./ReviewModal";
import { PenLine, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";

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
    // [FIX #3] Local state để cập nhật UI ngay lập tức, không phụ thuộc prop tĩnh từ server
    const [localHasReviewed, setLocalHasReviewed] = useState(hasReviewed);
    const router = useRouter();

    const handleClick = () => {
        if (!currentUser) {
            if (confirm("Bạn cần đăng nhập để viết đánh giá. Đăng nhập ngay?")) {
                router.push("/login?callbackUrl=" + window.location.pathname);
            }
            return;
        }
        setIsOpen(true);
    };

    // [FIX #3] Callback khi submit thành công — update local state NGAY
    const handleReviewSubmitted = (review: { rating: number; content: string }) => {
        setLocalHasReviewed(true);
        onReviewSubmitted?.(review);
    };

    // Dùng localHasReviewed thay vì hasReviewed (prop)
    if (localHasReviewed) {
        return (
            <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-green-500/20 text-green-300 border border-green-500/30 cursor-default select-none"
                title="Bạn đã đánh giá truyện này"
            >
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                Đã đánh giá
            </div>
        );
    }

    return (
        <>
            <button
                onClick={handleClick}
                className={className || "text-xs font-bold text-brand-primary bg-orange-50 px-4 py-2 rounded-lg hover:bg-orange-100 transition-all active:scale-95 flex items-center gap-2"}
            >
                <PenLine className="h-4 w-4" /> {text}
            </button>
            <ReviewModal
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                storyId={storyId}
                onReviewSubmitted={handleReviewSubmitted}
            />
        </>
    );
}
