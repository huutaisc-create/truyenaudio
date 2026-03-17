"use client";

import { useState } from "react";
import ReviewModal from "./ReviewModal";
import { PenLine } from "lucide-react";
import { useRouter } from "next/navigation"; // Added import for useRouter

export default function ReviewButton({ storyId, className, text = "VIẾT REVIEW", currentUser }: { storyId: string, className?: string, text?: string, currentUser?: any }) {
    const [isOpen, setIsOpen] = useState(false);
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

    return (
        <>
            <button
                onClick={handleClick}
                className={className || "text-xs font-bold text-brand-primary bg-orange-50 px-4 py-2 rounded-lg hover:bg-orange-100 transition-all active:scale-95 flex items-center gap-2"}
            >
                <PenLine className="h-4 w-4" /> {text}
            </button>
            <ReviewModal isOpen={isOpen} onClose={() => setIsOpen(false)} storyId={storyId} />
        </>
    );
}
