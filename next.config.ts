import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {}, // Bắt buộc giữ lại với Next.js 16

  experimental: {
    workerThreads: false,
    cpus: 1,
  },

  // ─────────────────────────────────────────────
  // FIX ẢNH: Cho phép next/image load ảnh từ R2
  // ─────────────────────────────────────────────
  images: {
    // Thêm domain R2 của bạn vào đây
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.r2.dev',       // Cloudflare R2 public bucket
      },
      {
        protocol: 'https',
        hostname: '**.r2.cloudflarestorage.com', // R2 private endpoint
      },
      // Nếu bạn có custom domain trỏ vào R2, thêm ở đây:
      // { protocol: 'https', hostname: 'cdn.yourdomain.com' },
    ],

    // FIX ẢNH SAI KÍCH THƯỚC (416 KiB):
    // next/image sẽ tự resize đúng theo sizes= trong component
    // Thêm các kích thước nhỏ cho ảnh cover thumbnail
    deviceSizes: [640, 828, 1080, 1200, 1920],
    imageSizes: [36, 48, 64, 96, 128, 160, 256],

    // Ưu tiên WebP/AVIF — giảm dung lượng thêm 30-50%
    formats: ['image/avif', 'image/webp'],

    // FIX CACHE ẢNH (TTL = None → 1 năm):
    // next/image tự thêm Cache-Control khi serve qua /_next/image
    // minimumCacheTTL tính bằng giây
    minimumCacheTTL: 31536000, // 1 năm
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

      // FIX CACHE ẢNH R2 (TTL = None):
      // Khi next/image optimize ảnh R2, kết quả được cache tại /_next/image
      // Header này đảm bảo browser cache lâu dài
      {
        source: '/_next/image(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
          { key: 'Vary', value: 'Accept' },
        ],
      },

      // FIX RENDER-BLOCKING CSS (60ms):
      // Cache các static chunks CSS/JS của Next.js lâu dài
      // Giúp lần tải thứ 2+ không bị blocking nữa
      {
        source: '/_next/static/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },

      // FIX UNUSED JS (25 KiB):
      // Gợi browser dùng compression tốt nhất
      {
        source: '/_next/static/chunks/(.*)\\.js',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
          { key: 'Content-Encoding', value: 'br' }, // Brotli nếu Vercel hỗ trợ
        ],
      },

      // Các trang thường
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
