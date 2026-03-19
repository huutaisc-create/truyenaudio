import type { Metadata, Viewport } from "next";
import { Roboto } from "next/font/google";
import "./globals.css";
import ClientLayout from "@/components/layout/ClientLayout";
import RegisterSW from "@/components/common/RegisterSW";
import LoadingProgressBar from "@/components/common/LoadingProgressBar";
import BackToTop from "@/components/common/BackToTop";
import { Suspense } from 'react';
import { SessionWrapper } from "@/components/providers/SessionWrapper";

// ── Font Fix ─────────────────────────────────────────────────────────────────
//
// FIX: Tất cả 3 weight dùng chung 1 variable "--font-roboto"
// → body chỉ cần dùng var(--font-roboto) là có cả 400/500/700
// → Next.js emit <link rel="preload"> cho cả 3 weight song song ngay trong <head>
//
// LỖI CŨ: roboto500 và roboto700 không có `variable` → không được inject vào CSS
// → browser phải tải thêm từ stylesheet → chậm 300-600ms theo Lighthouse
//
const roboto = Roboto({
  weight: ['400', '500', '700'],
  subsets: ['latin', 'vietnamese'],
  variable: '--font-roboto',
  display: 'swap',
  preload: true,
  // FIX: adjustFontFallback giúp tránh layout shift khi font swap
  adjustFontFallback: true,
});

export const viewport: Viewport = {
  themeColor: '#e8580a',
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "WebTruyen - Đọc truyện online miễn phí",
  description: "Nền tảng đọc và nghe truyện online hàng đầu với hàng ngàn tiểu thuyết chất lượng cao.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "WebTruyen",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
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
    <html lang="vi" className="light" suppressHydrationWarning>
      <head>
        {/* PWA iOS */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="WebTruyen" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <link rel="apple-touch-startup-image" href="/icons/icon-512.png" />

        {/*
          FIX CSS BLOCKING (tiết kiệm ~750ms theo Lighthouse):
          Các chunk CSS lớn đang block render vì browser phải parse xong mới render.
          Dùng preload + onload trick để load CSS async, không block.

          Lưu ý: hash của chunk CSS thay đổi mỗi lần build → không hardcode được.
          Thay vào đó dùng fetchpriority hint cho ảnh LCP (quan trọng hơn).

          FIX THỰC TẾ CHO CSS BLOCKING: tắt optimizeCss trong next.config.ts
          vì critters của Next.js đôi khi tạo ra blocking CSS thay vì giải quyết nó.
        */}

        {/*
          FIX LCP IMAGE: Hint browser biết sắp cần load ảnh lớn từ R2
          → browser kết nối sớm với R2 CDN, giảm latency đáng kể
        */}
        <link rel="preconnect" href="https://pub-e24f7ec645fc49d79de9bf92a252cc29.r2.dev" />
        <link rel="dns-prefetch" href="https://pub-e24f7ec645fc49d79de9bf92a252cc29.r2.dev" />
      </head>
      <body
        suppressHydrationWarning
        // FIX: dùng roboto.variable + roboto.className thay vì 3 className riêng
        // → đảm bảo cả 400/500/700 đều được inject qua CSS variable
        className={`${roboto.variable} ${roboto.className} min-h-screen antialiased`}
        style={{ fontFamily: 'var(--font-roboto), sans-serif' }}
      >
        <SessionWrapper>
          <RegisterSW />
          <Suspense fallback={null}>
            <LoadingProgressBar />
          </Suspense>
          <ClientLayout>{children}</ClientLayout>
          <BackToTop />
          {/* Version badge */}
          <div style={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            background: 'rgba(242,112,36,0.15)',
            border: '1px solid rgba(242,112,36,0.3)',
            borderRadius: 999,
            padding: '3px 10px',
            fontSize: 11,
            color: '#f27024',
            fontWeight: 500,
            zIndex: 9999,
            pointerEvents: 'none',
          }}>v 3.0</div>
        </SessionWrapper>
      </body>
    </html>
  );
}
