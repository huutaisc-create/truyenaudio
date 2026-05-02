import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const data = await request.formData();
        const onnxFile: File | null = data.get('onnxFile') as unknown as File;
        const jsonFile: File | null = data.get('jsonFile') as unknown as File;
        const voiceName = data.get('name') as string;

        if (!onnxFile || !jsonFile || !voiceName) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        if (!onnxFile.name.endsWith('.onnx') || !jsonFile.name.endsWith('.json')) {
            return NextResponse.json({ success: false, message: 'Invalid file extension' }, { status: 400 });
        }

        const { writeFile, readFile, mkdir } = await import('fs/promises');
        const { existsSync } = await import('fs');

        const uploadRoot = process.env.UPLOAD_STORAGE_DIR!;
        const uploadDir = `${uploadRoot}/models/custom`;
        await mkdir(uploadDir, { recursive: true });

        // Create a safe filename ID
        const safeName = voiceName.toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
        const timestamp = Date.now();
        const fileId = `${safeName}_${timestamp}`;

        const onnxBytes = await onnxFile.arrayBuffer();
        const jsonBytes = await jsonFile.arrayBuffer();

        await writeFile(`${uploadDir}/${fileId}.onnx`, Buffer.from(onnxBytes));
        await writeFile(`${uploadDir}/${fileId}.onnx.json`, Buffer.from(jsonBytes));

        // Update manifest
        const manifestPath = `${uploadDir}/manifest.json`;
        let manifest = [];
        if (existsSync(manifestPath)) {
            const fileContent = await readFile(manifestPath, 'utf8');
            try {
                manifest = JSON.parse(fileContent);
            } catch (e) {
                manifest = [];
            }
        }

        const newVoice = {
            id: fileId,
            name: voiceName,
            path: fileId
        };

        manifest.push(newVoice);
        await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

        return NextResponse.json({ success: true, voice: newVoice });

    } catch (error: any) {
        console.error('Upload error:', error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}
