// src/app/api/uploads/[filename]/route.ts
// Serve ảnh từ thư mục uploads động - bypass Turbopack bug

import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  // Bảo mật: chỉ cho phép file .webp, .jpg, .png - không cho phép path traversal
  if (!filename || filename.includes('..') || filename.includes('/')) {
    return new NextResponse('Not found', { status: 404 });
  }

  const allowedExtensions = ['.webp', '.jpg', '.jpeg', '.png', '.gif'];
  const ext = path.extname(filename).toLowerCase();
  if (!allowedExtensions.includes(ext)) {
    return new NextResponse('Not allowed', { status: 403 });
  }

  try {
    const filePath = path.join(process.cwd(), 'public', 'uploads', filename);
    const fileBuffer = await readFile(filePath);

    const contentTypeMap: Record<string, string> = {
      '.webp': 'image/webp',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
    };

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentTypeMap[ext] || 'image/webp',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Cross-Origin-Resource-Policy': 'cross-origin',
      },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
