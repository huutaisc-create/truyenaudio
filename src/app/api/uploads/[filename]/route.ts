// src/app/api/uploads/[filename]/route.ts
// Serve ảnh từ thư mục uploads (đọc thẳng từ đĩa) — bypass việc Next production
// KHÔNG serve file được thêm vào public/ sau khi build.

import { NextRequest, NextResponse } from 'next/server';

const CONTENT_TYPE: Record<string, string> = {
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  // Bảo mật: không cho path traversal / tách thư mục
  if (!filename || filename.includes('..') || filename.includes('/')) {
    return new NextResponse('Not found', { status: 404 });
  }

  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  if (!CONTENT_TYPE[ext]) {
    return new NextResponse('Not allowed', { status: 403 });
  }

  // 1) Đọc từ đĩa: UPLOAD_STORAGE_DIR/uploads/<file>
  try {
    const { readFile } = await import('fs/promises');
    const uploadRoot = process.env.UPLOAD_STORAGE_DIR!;
    const fileBuffer = await readFile(`${uploadRoot}/uploads/${filename}`);
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': CONTENT_TYPE[ext],
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Cross-Origin-Resource-Policy': 'cross-origin',
      },
    });
  } catch {
    // 2) DEV: file nằm trên VPS, máy local không có → proxy sang server thật để xem.
    //    Chỉ bật khi có DEV_ASSET_PROXY_ORIGIN (đặt trong .env.local local; prod để trống).
    const origin = process.env.DEV_ASSET_PROXY_ORIGIN?.replace(/\/$/, '');
    if (origin) {
      try {
        const up = await fetch(`${origin}/api/uploads/${filename}`);
        if (up.ok) {
          const buf = Buffer.from(await up.arrayBuffer());
          return new NextResponse(buf, {
            status: 200,
            headers: {
              'Content-Type': CONTENT_TYPE[ext],
              'Cache-Control': 'public, max-age=86400',
              'Cross-Origin-Resource-Policy': 'cross-origin',
            },
          });
        }
      } catch {
        // bỏ qua → rơi xuống 404
      }
    }
    return new NextResponse('Not found', { status: 404 });
  }
}
