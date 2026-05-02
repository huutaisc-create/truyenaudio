import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Turbopack: không resolve các thư mục static lớn trong public/
    resolveAlias: {},
  },

  experimental: {
    workerThreads: false,
    cpus: 1,
  },

  // ── Bỏ qua scan thư mục lớn khi output tracing ──────────────────────────
  // chapters nằm NGOÀI public/ trên VPS (/var/www/truyenaudio/chapters)
  // nên outputFileTracingExcludes chỉ cần cover avatars/covers/uploads
  outputFileTracingExcludes: {
    '*': [
      'public/covers/**',
      'public/avatars/**',
      'public/uploads/**',
      'public/models/**',
      'public/piper-wasm/**',
    ],
  },

  compiler: {
    removeConsole: process.env.NODE_ENV === 'production'
      ? { exclude: ['error', 'warn'] }
      : false,
  },

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' }, // ảnh Google account
    ],
    deviceSizes: [640, 828, 1080, 1200, 1920],
    imageSizes: [36, 48, 64, 96, 128, 160, 256],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 7,
  },

  async headers() {
    return [
      {
        source: '/(uploads|avatars|covers)/(.*)',
        headers: [
          { key: 'Cross-Origin-Resource-Policy', value: 'cross-origin' },
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
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
