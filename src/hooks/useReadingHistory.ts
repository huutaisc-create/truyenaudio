"use client";

import { useState, useEffect, useCallback } from 'react';

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
        const saved = localStorage.getItem('reading_history');
        if (saved) {
            try {
                setHistory(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to parse history", e);
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

            // Side effect: Save to local storage
            localStorage.setItem('reading_history', JSON.stringify(updated));

            return updated;
        });
    }, []);

    return { history, addToHistory, isLoaded };
}
