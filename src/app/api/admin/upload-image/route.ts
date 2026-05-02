// src/app/api/admin/upload-image/route.ts
// Upload ảnh bìa truyện lên disk, serve tĩnh qua Next.js tại /covers/<slug>.<ext>

import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const UPLOAD_SECRET = process.env.UPLOAD_SECRET || "df5e8753a931894d842645d812d2b23fe89917d87def1633c8926f2c67728a5c";

const COVERS_ROOT = process.env.COVERS_STORAGE_PATH
    ?? `${process.cwd()}/public/covers`;

const ALLOWED_MIME: Record<string, string> = {
    "image/jpeg":  "jpg",
    "image/jpg":   "jpg",
    "image/png":   "png",
    "image/webp":  "webp",
    "image/gif":   "gif",
    "image/avif":  "avif",
};

export async function POST(request: NextRequest) {
    // Auth
    const secret = request.headers.get("X-Upload-Secret");
    if (!secret || secret !== UPLOAD_SECRET) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    try {
        const formData = await request.formData();
        const file = formData.get("image") as File | null;
        const slug = (formData.get("slug") as string | null)?.trim();

        if (!file || !slug) {
            return NextResponse.json(
                { success: false, message: "Missing required fields: image, slug" },
                { status: 400 }
            );
        }

        // Xác định extension từ MIME type của file gốc
        const mime = file.type?.toLowerCase() || "";
        const ext  = ALLOWED_MIME[mime]
            ?? path.extname(file.name).replace(".", "").toLowerCase()
            ?? "jpg";

        if (!ALLOWED_MIME[mime] && !ext) {
            return NextResponse.json(
                { success: false, message: `Unsupported image type: ${mime}` },
                { status: 400 }
            );
        }

        // Đọc buffer
        const buffer = Buffer.from(await file.arrayBuffer());

        // Lưu vào public/covers/<slug>.<ext>
        await mkdir(COVERS_ROOT, { recursive: true });
        const filename = `${slug}.${ext}`;
        await writeFile(`${COVERS_ROOT}/${filename}`, buffer);

        const url = `/covers/${filename}`;
        return NextResponse.json({ success: true, url, filename });

    } catch (error: any) {
        console.error("Upload Image Error:", error);
        return NextResponse.json(
            { success: false, message: error.message || "Internal server error" },
            { status: 500 }
        );
    }
}
