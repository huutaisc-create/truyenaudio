'use client';

import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

// ✅ Compile regex 1 lần ngoài component — không tạo lại mỗi render
const READING_PAGE_RE = /^\/truyen\/[^/]+\/chuong-\d+/;
const LISTENING_PAGE_RE = /^\/truyen\/[^/]+\/nghe/;

export default function ClientLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    // ✅ useMemo — chỉ tính lại khi pathname thay đổi
    const hideLayout = useMemo(
        () => READING_PAGE_RE.test(pathname) || LISTENING_PAGE_RE.test(pathname),
        [pathname]
    );

    return (
        <>
            {!hideLayout && <Header />}
            <main>{children}</main>
            {!hideLayout && <Footer />}
        </>
    );
}
