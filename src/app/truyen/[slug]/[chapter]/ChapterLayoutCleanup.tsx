'use client';

import { useEffect } from 'react';

export default function ChapterLayoutCleanup() {
    useEffect(() => {
        // Re-set --chapter-bg mỗi lần mount (mỗi lần navigate sang chương mới)
        // vì themeScript chỉ chạy lần đầu hard load
        const THEME_BG: Record<string, string> = {
            sepia: '#FDFAF7',
            white: '#FFFFFF',
            green: '#F0F4F0',
            night: '#0F0A05',
        };
        let bg = '#0F0A05';
        try {
            const s = localStorage.getItem('mtc_reading_settings');
            if (s) {
                const theme = JSON.parse(s).theme;
                if (theme && THEME_BG[theme]) bg = THEME_BG[theme];
            }
        } catch(e) {}
        document.documentElement.style.setProperty('--chapter-bg', bg);

        return () => {
            // Cleanup khi rời khỏi trang đọc
            document.documentElement.style.removeProperty('--chapter-bg');
            document.body.style.background = '';
        };
    }, []);

    return null;
}
