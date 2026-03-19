import type { Metadata, Viewport } from "next";
import "./globals.css";
import ClientLayout from "@/components/layout/ClientLayout";
import RegisterSW from "@/components/common/RegisterSW";
import LoadingProgressBar from "@/components/common/LoadingProgressBar";
import BackToTop from "@/components/common/BackToTop";
import { Suspense } from 'react';
import { SessionWrapper } from "@/components/providers/SessionWrapper";

// ── FONT: Bỏ hoàn toàn Google Font / @fontsource ─────────────────────────────
// Dùng system font stack → không load file woff2 nào → LCP giảm ~700ms
// Android: Roboto (có sẵn), iOS: SF Pro, Windows: Segoe UI
// Người dùng Việt Nam chủ yếu dùng Android/iOS → font system trông rất tốt
// ─────────────────────────────────────────────────────────────────────────────

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

        {/* Preconnect R2 CDN để giảm latency load ảnh bìa */}
        <link rel="preconnect" href="https://pub-e24f7ec645fc49d79de9bf92a252cc29.r2.dev" />
        <link rel="dns-prefetch" href="https://pub-e24f7ec645fc49d79de9bf92a252cc29.r2.dev" />
      </head>
      <body
        suppressHydrationWarning
        className="min-h-screen antialiased"
        style={{
          // Android có sẵn Roboto, iOS có SF Pro, Windows có Segoe UI
          // → trông y hệt nhưng không cần load gì cả
          fontFamily: 'Roboto, "Segoe UI", system-ui, -apple-system, sans-serif',
        }}
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
          }}>v 3.2</div>
        </SessionWrapper>
      </body>
    </html>
  );
}
