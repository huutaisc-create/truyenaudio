"use client";

// D:\Webtruyen\webtruyen-app\src\components\story\StoryRatingClient.tsx
//
// Client Component bọc phần rating + danh sách review trên trang truyện.
// Lý do tách ra: page.tsx là Server Component (revalidate=60), không có state.
// Component này giữ reviews trong useState → review mới hiện ngay sau submit,
// không cần refresh.

import { useState } from "react";
import { Star } from "lucide-react";
import ReviewButton from "./ReviewButton";

type ReviewItem = {
    id?: string;
    rating: number;
    content: string;
    createdAt: string | Date;
    user: {
        name: string;
        image?: string | null;
    };
};

type StoryRatingClientProps = {
    storyId: string;
    currentUser?: { id: string; name: string; image?: string | null } | null;
    hasReviewed: boolean;
    initialRating: number;
    initialRatingCount: number;
    initialReviews: ReviewItem[];
    // class của nút ReviewButton (khớp với style hiện tại trên page.tsx)
    reviewButtonClassName?: string;
};

export default function StoryRatingClient({
    storyId,
    currentUser,
    hasReviewed,
    initialRating,
    initialRatingCount,
    initialReviews,
    reviewButtonClassName,
}: StoryRatingClientProps) {
    const [reviews, setReviews] = useState<ReviewItem[]>(initialReviews);
    const [ratingScore, setRatingScore] = useState(initialRating);
    const [ratingCount, setRatingCount] = useState(initialRatingCount);

    const handleReviewSubmitted = (review: { rating: number; content: string }) => {
        // Thêm review mới vào đầu list ngay lập tức
        const newReview: ReviewItem = {
            rating: review.rating,
            content: review.content,
            createdAt: new Date(),
            user: {
                name: currentUser?.name ?? "Bạn",
                image: currentUser?.image ?? null,
            },
        };
        setReviews(prev => [newReview, ...prev]);

        // Cập nhật rating score ngay (tính lại trung bình tạm thời)
        const newCount = ratingCount + 1;
        const newScore = parseFloat(
            ((ratingScore * ratingCount + review.rating) / newCount).toFixed(1)
        );
        setRatingScore(newScore);
        setRatingCount(newCount);
    };

    return (
        <>
            {/* Dòng rating + nút Đánh giá */}
            <div className="flex items-center gap-2 flex-wrap">
                <span
                    role="img"
                    aria-label={ratingCount === 0 ? "Chưa có đánh giá" : `Điểm đánh giá: ${ratingScore} trên 5 sao`}
                    className="flex"
                >
                    {[1, 2, 3, 4, 5].map(i => (
                        <Star
                            key={i}
                            className={`h-4 w-4 fill-current ${
                                ratingCount > 0 && i <= Math.round(ratingScore)
                                    ? "text-amber-400"
                                    : "text-zinc-300"
                            }`}
                            aria-hidden="true"
                        />
                    ))}
                </span>
                {ratingCount > 0 ? (
                    <>
                        <span className="text-lg font-black text-warm-gold">{ratingScore}</span>
                        <span className="text-base font-bold text-warm-ink-soft">
                            ({ratingCount.toLocaleString("vi-VN")})
                        </span>
                    </>
                ) : (
                    <span className="text-base font-bold text-warm-ink-soft">0 đánh giá</span>
                )}
                <ReviewButton
                    storyId={storyId}
                    text="Đánh giá"
                    currentUser={currentUser}
                    hasReviewed={hasReviewed}
                    onReviewSubmitted={handleReviewSubmitted}
                    className={
                        reviewButtonClassName ||
                        "flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-bold bg-warm-primary-pale text-[#8c3a08] border border-warm-primary/50 hover:bg-warm-primary hover:text-white transition-all"
                    }
                />
            </div>

            {/* Danh sách reviews — hiện ngay khi submit */}
            {reviews.length > 0 && (
                <div className="mt-3 space-y-2">
                    {reviews.map((r, i) => (
                        <div
                            key={r.id ?? `review-${i}`}
                            className="flex gap-2.5 p-3 rounded-xl bg-warm-bg border border-warm-border-soft"
                        >
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                    <span className="text-sm font-bold text-warm-ink">
                                        {r.user.name}
                                    </span>
                                    <span className="flex" aria-label={`${r.rating} sao`}>
                                        {[1, 2, 3, 4, 5].map(s => (
                                            <Star
                                                key={s}
                                                className={`h-3 w-3 fill-current ${
                                                    s <= r.rating ? "text-amber-400" : "text-zinc-200"
                                                }`}
                                                aria-hidden="true"
                                            />
                                        ))}
                                    </span>
                                </div>
                                {r.content && (
                                    <p className="text-sm text-warm-ink-soft leading-relaxed">
                                        {r.content}
                                    </p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </>
    );
}
