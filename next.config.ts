import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},

  experimental: {
    workerThreads: false,
    cpus: 1,
    // FIX CSS BLOCKING (ảnh 2): inline critical CSS, defer non-critical
    // Cần cài: npm install critters --save-dev
    optimizeCss: true,
  },

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.r2.dev' },
      { protocol: 'https', hostname: '**.r2.cloudflarestorage.com' },
    ],
    deviceSizes: [640, 828, 1080, 1200, 1920],
    imageSizes: [36, 48, 64, 96, 128, 160, 256],
    formats: ['image/avif', 'image/webp'],

    // FIX CACHE:
    // KHÔNG dùng 1 năm cho ảnh bìa vì ảnh có thể được update.
    // next/image cache tại /_next/image — khi R2 URL không đổi
    // nhưng nội dung ảnh đổi → user vẫn thấy ảnh cũ nếu TTL quá dài.
    //
    // Giải pháp: TTL 7 ngày — đủ để cache hiệu quả,
    // không quá dài khi ảnh bìa được cập nhật.
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
      // Cache ảnh optimize 7 ngày — khớp với minimumCacheTTL
      {
        source: '/_next/image(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=86400' },
          { key: 'Vary', value: 'Accept' },
        ],
      },
      // Static assets (JS/CSS) — 1 năm vì Next.js tự đổi hash khi build mới
      {
        source: '/_next/static/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/_next/static/chunks/(.*)\\.js',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
          { key: 'Content-Encoding', value: 'br' },
        ],
      },
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
