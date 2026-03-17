"use client";

import React, { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';

export default function BackToTop() {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const toggleVisible = () => {
            if (window.scrollY > 500) setVisible(true);
            else setVisible(false);
        };
        window.addEventListener('scroll', toggleVisible);
        return () => window.removeEventListener('scroll', toggleVisible);
    }, []);

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    if (!visible) return null;

    return (
        <button
            onClick={scrollToTop}
            className="fixed bottom-8 right-8 z-[60] h-12 w-12 flex items-center justify-center bg-white border border-zinc-100 text-brand-primary rounded-full shadow-xl hover:bg-orange-50 active:scale-95 transition-all animate-in fade-in slide-in-from-bottom-4 duration-300"
            aria-label="Back to top"
        >
            <ArrowUp className="h-6 w-6" />
        </button>
    );
}
