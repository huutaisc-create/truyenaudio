'use client';

import { usePathname } from 'next/navigation';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    // Ẩn Header và Footer trên trang đọc chương và trang nghe
    const isReadingPage = /^\/truyen\/[^/]+\/chuong-\d+/.test(pathname);
    const isListeningPage = /^\/truyen\/[^/]+\/nghe/.test(pathname);
    const hideLayout = isReadingPage || isListeningPage;

    return (
        <>
            {!hideLayout && <Header />}
            <main>{children}</main>
            {!hideLayout && <Footer />}
        </>
    );
}
