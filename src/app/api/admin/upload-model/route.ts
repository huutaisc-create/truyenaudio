import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

// Upload a model file with a specific filename (for deployment from dev machine)
// Auth: X-Upload-Secret header must match UPLOAD_SECRET env var
export async function POST(request: NextRequest) {
    const secret = request.headers.get('x-upload-secret');
    if (!secret || secret !== process.env.UPLOAD_SECRET) {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    try {
        const data = await request.formData();
        const file = data.get('file') as File | null;
        const filename = data.get('filename') as string | null;

        if (!file || !filename) {
            return NextResponse.json({ success: false, message: 'Missing file or filename' }, { status: 400 });
        }

        // Sanitize filename — only allow safe chars, no path traversal
        const safeName = path.basename(filename).replace(/[^a-zA-Z0-9_.\-]/g, '');
        if (!safeName || safeName !== filename) {
            return NextResponse.json({ success: false, message: 'Invalid filename' }, { status: 400 });
        }

        const uploadRoot = process.env.UPLOAD_STORAGE_DIR!;
        const modelsDir = path.join(uploadRoot, 'models', 'custom');
        await mkdir(modelsDir, { recursive: true });

        const destPath = path.join(modelsDir, safeName);
        const bytes = await file.arrayBuffer();
        await writeFile(destPath, Buffer.from(bytes));

        return NextResponse.json({
            success: true,
            path: `/models/custom/${safeName}`,
            size: bytes.byteLength,
        });
    } catch (error: any) {
        console.error('[upload-model] error:', error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}
