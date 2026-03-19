import React from 'react';

// Script chạy trước paint để set CSS variable --chapter-bg
// KHÔNG set body.style.background trực tiếp vì sẽ leak sang trang khác
// khi navigate bằng Next.js client-side (không reload trang)
const themeScript = `
(function() {
    var THEME_BG = { sepia: '#FDFAF7', white: '#FFFFFF', green: '#F0F4F0', night: '#0F0A05' };
    var bg = '#0F0A05';
    try {
        var s = localStorage.getItem('mtc_reading_settings');
        if (s) {
            var theme = JSON.parse(s).theme;
            if (theme && THEME_BG[theme]) bg = THEME_BG[theme];
        }
    } catch(e) {}
    document.documentElement.style.setProperty('--chapter-bg', bg);
    // ĐÃ XÓA: document.body.style.background = bg;
    // Lý do: inline style trên body không bị cleanup khi navigate ra trang khác
    // → background đen bị "dính" lại cho đến khi user refresh
})();
`;

// Client component nhỏ — cleanup CSS variable khi unmount (navigate ra khỏi trang đọc)
// Đặt trong file riêng để tránh làm layout thành 'use client'
import ChapterLayoutCleanup from './ChapterLayoutCleanup';

export default function ChapterLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            <script dangerouslySetInnerHTML={{ __html: themeScript }} />
            <ChapterLayoutCleanup />
            <div style={{ background: 'var(--chapter-bg, #0F0A05)', minHeight: '100vh' }}>
                {children}
            </div>
        </>
    );
}
