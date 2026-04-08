import type { Metadata, Viewport } from "next";
import "./globals.css";
import ClientLayout from "@/components/layout/ClientLayout";
import RegisterSW from "@/components/common/RegisterSW";
import LoadingProgressBar from "@/components/common/LoadingProgressBar";
import BackToTop from "@/components/common/BackToTop";
import { Suspense } from 'react';
import { SessionWrapper } from "@/components/providers/SessionWrapper";

export const viewport: Viewport = {
  themeColor: '#e8580a',
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "Truyện Audio Của Tôi - Nghe truyện audio online miễn phí",
  description: "Nền tảng nghe truyện audio online hàng đầu với hàng ngàn tiểu thuyết chất lượng cao, không quảng cáo.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Truyện Audio Của Tôi",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/favicon-toi.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // data-theme="male" = Warm Noir default
    // ThemeToggle trong Header sẽ đổi attribute này thành "female" khi user bấm
    <html lang="vi" data-theme="male" suppressHydrationWarning>
      <head>
        {/* Favicon */}
        <link rel="icon" href="/favicon-toi.svg" type="image/svg+xml" />
        <link rel="shortcut icon" href="/favicon-toi.svg" />

        {/* PWA iOS */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Truyện Audio Của Tôi" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <link rel="apple-touch-startup-image" href="/icons/icon-512.png" />

        {/* Preconnect R2 CDN */}
        <link rel="preconnect" href="https://pub-e24f7ec645fc49d79de9bf92a252cc29.r2.dev" />
        <link rel="dns-prefetch" href="https://pub-e24f7ec645fc49d79de9bf92a252cc29.r2.dev" />

        {/* Khôi phục theme từ localStorage — chạy trước khi React hydrate để tránh flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var t = localStorage.getItem('mtc-theme');
                if (t === 'female') document.documentElement.setAttribute('data-theme', 'female');
              } catch(e) {}
            `,
          }}
        />
      </head>
      <body
        suppressHydrationWarning
        className="min-h-screen antialiased"
        style={{ fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' }}
      >
        <SessionWrapper>
          <RegisterSW />
          <Suspense fallback={null}>
            <LoadingProgressBar />
          </Suspense>
          <ClientLayout>{children}</ClientLayout>
          <BackToTop />
          
        </SessionWrapper>
      </body>
    </html>
  );
}
