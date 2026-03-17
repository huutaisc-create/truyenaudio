import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {}, // Bắt buộc giữ lại với Next.js 16

  // Tắt auto preload ảnh của Next.js (tránh warning "preloaded but not used")
  experimental: {
    workerThreads: false,
    cpus: 1,
  },

  async headers() {
    return [
      // Header riêng cho ảnh uploads — cho phép cross-origin
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
      // Các trang thường — bỏ require-corp vì nó chặn ảnh load
      {
        source: '/(.*)',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          // Đổi từ require-corp → unsafe-none để không chặn ảnh static
          { key: 'Cross-Origin-Embedder-Policy', value: 'unsafe-none' },
        ],
      },
    ];
  },
};

export default nextConfig;
