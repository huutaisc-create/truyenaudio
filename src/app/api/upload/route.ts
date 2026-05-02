import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    const data = await request.formData();
    const file: File | null = data.get('file') as unknown as File;
    const type = (data.get('type') as string) || 'general';

    if (!file) {
        return NextResponse.json({ success: false, message: 'No file uploaded' }, { status: 400 });
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
        return NextResponse.json({ success: false, message: 'Chỉ chấp nhận file ảnh (jpg, png, webp)' }, { status: 400 });
    }

    if (file.size > 5 * 1024 * 1024) {
        return NextResponse.json({ success: false, message: 'File quá lớn, tối đa 5MB' }, { status: 400 });
    }

    try {
        const bytes = await file.arrayBuffer();
        const inputBuffer = Buffer.from(bytes);

        const sharp = (await import('sharp')).default;
        const { writeFile, mkdir } = await import('fs/promises');
        const timestamp = Date.now();

        let outputBuffer: Buffer;
        let filename: string;
        let folder: string;

        if (type === 'avatar') {
            outputBuffer = await sharp(inputBuffer)
                .resize(200, 200, { fit: 'cover', position: 'centre' })
                .webp({ quality: 80 })
                .toBuffer();
            filename = `avatar-${timestamp}.webp`;
            folder = 'avatars';
        } else if (type === 'cover') {
            outputBuffer = await sharp(inputBuffer)
                .resize(600, 800, { fit: 'inside', withoutEnlargement: true })
                .webp({ quality: 85 })
                .toBuffer();
            filename = `cover-${timestamp}.webp`;
            folder = 'covers';
        } else {
            outputBuffer = await sharp(inputBuffer)
                .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
                .webp({ quality: 85 })
                .toBuffer();
            const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '').replace(/\.[^.]+$/, '');
            filename = `${timestamp}-${safeName}.webp`;
            folder = 'uploads';
        }

        // UPLOAD_STORAGE_DIR phải set trong .env.local trên VPS
        // VD: UPLOAD_STORAGE_DIR=/var/www/truyenaudio/public
        // → path hoàn toàn dynamic, Turbopack không scan được public/
        const uploadRoot = process.env.UPLOAD_STORAGE_DIR!;
        const saveDir = `${uploadRoot}/${folder}`;
        await mkdir(saveDir, { recursive: true });
        await writeFile(`${saveDir}/${filename}`, outputBuffer);

        return NextResponse.json({
            success: true,
            url: `/${folder}/${filename}`,
            size: outputBuffer.length,
        });
    } catch (error) {
        console.error('Error processing image:', error);
        return NextResponse.json({ success: false, message: 'Lỗi xử lý ảnh' }, { status: 500 });
    }
}
