"use client";

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
    reviewButtonClassName?: string;
    showReviewList?: boolean;
};

export default function StoryRatingClient({
    storyId,
    currentUser,
    hasReviewed,
    initialRating,
    initialRatingCount,
    initialReviews,
    reviewButtonClassName,
    showReviewList = true,
}: StoryRatingClientProps) {
    const [reviews, setReviews] = useState<ReviewItem[]>(initialReviews);
    const [ratingScore, setRatingScore] = useState(initialRating);
    const [ratingCount, setRatingCount] = useState(initialRatingCount);

    const handleReviewSubmitted = (review: { rating: number; content: string }) => {
        const newReview: ReviewItem = {
            rating: review.rating,
            content: review.content,
            createdAt: new Date(),
            user: {
                name: currentUser?.name ?? "Ban",
                image: currentUser?.image ?? null,
            },
        };
        setReviews(prev => [newReview, ...prev]);

        const newCount = ratingCount + 1;
        const newScore = parseFloat(
            ((ratingScore * ratingCount + review.rating) / newCount).toFixed(1)
        );
        setRatingScore(newScore);
        setRatingCount(newCount);
    };

    return (
        <>
            <div className="flex items-center gap-2 flex-wrap">
                <span
                    role="img"
                    aria-label={ratingCount === 0 ? "Chua co danh gia" : `Diem danh gia: ${ratingScore} tren 5 sao`}
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
                    <span className="text-base font-bold text-warm-ink-soft">(0)</span>
                )}
                <ReviewButton
                    storyId={storyId}
                    text="Danh gia"
                    currentUser={currentUser}
                    hasReviewed={hasReviewed}
                    onReviewSubmitted={handleReviewSubmitted}
                    className={
                        reviewButtonClassName ||
                        "flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-bold bg-warm-primary-pale text-[#8c3a08] border border-warm-primary/50 hover:bg-warm-primary hover:text-white transition-all"
                    }
                />
            </div>

            {showReviewList && reviews.length > 0 && (
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
                                    <p className="text-sm text-white/80 leading-relaxed">
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
