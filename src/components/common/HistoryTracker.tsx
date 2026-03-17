"use client";

import { useEffect, useRef } from 'react';
import { useReadingHistory } from '@/hooks/useReadingHistory';
import { useSession } from 'next-auth/react';
import { trackChapterRead } from '@/actions/stories';

export default function HistoryTracker({
    slug,
    title,
    chapterIndex,
    coverImage,
    chapterId,
}: {
    slug: string;
    title: string;
    chapterIndex: number;
    coverImage: string | null;
    chapterId: string;
}) {
    const { addToHistory, isLoaded } = useReadingHistory();
    const { data: session } = useSession();
    const trackedKey = useRef<string>('');

    useEffect(() => {
        if (!isLoaded || !slug || !title) return;

        // Lưu vào localStorage (giữ nguyên logic cũ)
        addToHistory(slug, title, chapterIndex, coverImage || undefined);

        // Gọi server action tăng chaptersRead nếu đã đăng nhập
        // Dùng key để tránh gọi 2 lần do React StrictMode
        const key = `${slug}-${chapterId}`;
        if (session?.user?.id && trackedKey.current !== key) {
            trackedKey.current = key;
            trackChapterRead(slug, chapterId).catch(console.error);
        }
    }, [slug, title, chapterIndex, coverImage, chapterId, isLoaded, session?.user?.id]);

    return null;
}
