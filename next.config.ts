import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},

  experimental: {
    // ✅ Bỏ workerThreads: false và cpus: 1
    // Các option này giới hạn hiệu năng build, không có lợi ích gì trên Vercel

    // ✅ Giữ optimizeCss — inline critical CSS, giảm blocking render ~190ms
    // Cần cài: npm install critters --save-dev
    optimizeCss: true,

    // ✅ Thêm browsersListForSwc — ngăn polyfill không cần thiết cho trình duyệt hiện đại
    // Giảm ~14 KiB legacy JS (Array.at, Object.hasOwn, String.trimEnd, v.v.)
    browsersListForSwc: true,
  },

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.r2.dev' },
      { protocol: 'https', hostname: '**.r2.cloudflarestorage.com' },
    ],
    deviceSizes: [640, 828, 1080, 1200, 1920],
    imageSizes: [36, 48, 64, 96, 128, 160, 256],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 7, // 7 ngày
  },

  async headers() {
    return [
      {
        source: '/uploads/(.*)',
        headers: [
          { key: 'Cross-Origin-Resource-Policy', value: 'cross-origin' },
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/(uploads|avatars)/(.*)',
        headers: [
          { key: 'Cross-Origin-Resource-Policy', value: 'cross-origin' },
        ],
      },
      {
        source: '/_next/image(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=86400' },
          { key: 'Vary', value: 'Accept' },
        ],
      },
      {
        source: '/_next/static/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      // ✅ Bỏ block set Content-Encoding: br thủ công
      // Vercel/server tự xử lý compression — set thủ công gây lỗi double-encoding
      {
        source: '/(.*)',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'unsafe-none' },
        ],
      },
    ];
  },
};

export default nextConfig;
