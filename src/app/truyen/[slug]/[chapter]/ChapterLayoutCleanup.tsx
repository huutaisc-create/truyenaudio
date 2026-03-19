'use client';

import { useEffect } from 'react';

// Cleanup CSS variable --chapter-bg khi navigate ra khỏi trang đọc
// Nếu không cleanup, --chapter-bg vẫn còn trên <html> element
// nhưng vì chỉ là CSS variable (không phải inline style trên body)
// nên nó không ảnh hưởng trang khác — trang chủ không dùng var này.
//
// Tuy nhiên vẫn cleanup cho sạch:
export default function ChapterLayoutCleanup() {
    useEffect(() => {
        return () => {
            // Chạy khi component unmount (navigate ra khỏi chapter)
            document.documentElement.style.removeProperty('--chapter-bg');
            // Reset body background về mặc định của trang chủ
            document.body.style.background = '';
        };
    }, []);

    return null;
}
