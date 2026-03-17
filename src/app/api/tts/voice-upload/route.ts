import { NextRequest, NextResponse } from 'next/server';
import { writeFile, readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

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

        const uploadDir = join(process.cwd(), 'public', 'models', 'custom');

        // Create a safe filename ID
        // normalize string, remove special chars, replace space with underscore
        const safeName = voiceName.toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
        const timestamp = Date.now();
        const fileId = `${safeName}_${timestamp}`; // unique ID

        const onnxBytes = await onnxFile.arrayBuffer();
        const jsonBytes = await jsonFile.arrayBuffer();

        const onnxPath = join(uploadDir, `${fileId}.onnx`);
        const jsonPath = join(uploadDir, `${fileId}.onnx.json`); // Must follow pattern {id}.onnx.json for simplicity

        await writeFile(onnxPath, Buffer.from(onnxBytes));
        await writeFile(jsonPath, Buffer.from(jsonBytes));

        // Update manifest
        const manifestPath = join(uploadDir, 'manifest.json');
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
            path: fileId // filename without extension
        };

        manifest.push(newVoice);

        await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

        return NextResponse.json({ success: true, voice: newVoice });

    } catch (error: any) {
        console.error('Upload error:', error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}
