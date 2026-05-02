// D:\Webtruyen\webtruyen-app\src\app\api\admin\stories\[slug]\route.ts

import { NextRequest, NextResponse } from "next/server";
import { rm } from "fs/promises";
import path from "path";
import db from "@/lib/db";

const UPLOAD_SECRET = "df5e8753a931894d842645d812d2b23fe89917d87def1633c8926f2c67728a5c";

const CHAPTERS_ROOT = process.env.CHAPTERS_STORAGE_PATH
    ?? `${process.cwd()}/public/chapters`;
const COVERS_ROOT = `${process.cwd()}/public/covers`;

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    const secret = request.headers.get("X-Upload-Secret");
    if (!secret || secret !== UPLOAD_SECRET) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { slug } = await params;
    if (!slug) {
        return NextResponse.json({ success: false, message: "Missing slug" }, { status: 400 });
    }

    try {
        const story = await db.story.findUnique({
            where:  { slug },
            select: { id: true, title: true },
        });

        if (!story) {
            return NextResponse.json(
                { success: false, message: `Story '${slug}' not found` },
                { status: 404 }
            );
        }

        // Xóa story — onDelete: Cascade tự xóa chapters, reviews, history, library...
        await db.story.delete({ where: { slug } });

        // Xóa file trên disk (không throw nếu không tồn tại)
        await rm(`${CHAPTERS_ROOT}/${slug}`, { recursive: true, force: true });
        await rm(`${COVERS_ROOT}/${slug}.webp`, { force: true });

        return NextResponse.json({
            success: true,
            message: `Deleted '${story.title}' — DB + chapters + cover`,
        });

    } catch (error: any) {
        console.error("Delete story error:", error);
        return NextResponse.json(
            { success: false, message: error.message || "Internal server error" },
            { status: 500 }
        );
    }
}
