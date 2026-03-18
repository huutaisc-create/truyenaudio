import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},

  experimental: {
    optimizeCss: true,
  },

  // ✅ Vercel Cron — ping DB mỗi 5 phút để Neon không bị idle/cold start
  // Vercel tự gửi request đến /api/keep-alive với header Authorization: Bearer CRON_SECRET
  crons: [
    {
      path: '/api/keep-alive',
      schedule: '*/5 * * * *',
    },
  ],

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.r2.dev' },
      { protocol: 'https', hostname: '**.r2.cloudflarestorage.com' },
    ],
    deviceSizes: [640, 828, 1080, 1200, 1920],
    imageSizes: [36, 48, 64, 96, 128, 160, 256],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 7,
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
