import React from 'react';

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
    document.body.style.background = bg;
})();
`;

export default function ChapterLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            <script dangerouslySetInnerHTML={{ __html: themeScript }} />
            <div style={{ background: 'var(--chapter-bg, #0F0A05)', minHeight: '100vh' }}>
                {children}
            </div>
        </>
    );
}
