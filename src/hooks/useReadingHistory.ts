"use client";

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'listening_history';

export interface HistoryItem {
    slug: string;
    title: string;
    chapterIndex?: number;
    coverImage?: string;
    timestamp: number;
}

export function useReadingHistory() {
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        // Migrate dữ liệu cũ từ 'reading_history' sang 'listening_history' nếu có
        const old = localStorage.getItem('reading_history');
        const current = localStorage.getItem(STORAGE_KEY);
        if (old && !current) {
            localStorage.setItem(STORAGE_KEY, old);
            localStorage.removeItem('reading_history');
        }

        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                setHistory(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to parse listening history", e);
            }
        }
        setIsLoaded(true);
    }, []);

    const addToHistory = useCallback((slug: string, title: string, chapterIndex?: number, coverImage?: string) => {
        setHistory(prev => {
            const newItem: HistoryItem = {
                slug,
                title,
                chapterIndex,
                coverImage,
                timestamp: Date.now()
            };
            const filtered = prev.filter(item => item.slug !== slug);
            const updated = [newItem, ...filtered].slice(0, 5); // Keep last 5

            localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

            return updated;
        });
    }, []);

    return { history, addToHistory, isLoaded };
}
