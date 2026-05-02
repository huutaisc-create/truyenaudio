import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import db from "@/lib/db";

// Thư mục gốc lưu chapter trên disk (phải khớp với CHAPTERS_STORAGE_PATH trong admin API)
const CHAPTERS_ROOT = process.env.CHAPTERS_STORAGE_PATH
    ?? `${process.cwd()}/public/chapters`;

/**
 * Đọc nội dung chapter:
 *  - Nếu contentUrl là relative path bắt đầu bằng /chapters/ → đọc từ disk
 *  - Ngược lại (URL tuyệt đối) → fetch HTTP (tương thích chapter cũ trên R2)
 */
async function fetchChapterContent(contentUrl: string): Promise<string> {
    if (contentUrl.startsWith("/chapters/")) {
        // Đọc từ disk: bỏ prefix "/chapters/" và ghép vào CHAPTERS_ROOT
        const relativePath = contentUrl.slice("/chapters/".length); // "slug/1.txt"
        const filePath = `${CHAPTERS_ROOT}/${relativePath}`;
        return await readFile(filePath, "utf-8");
    }
    // Fetch HTTP (R2 hoặc bất kỳ URL tuyệt đối nào)
    const res = await fetch(contentUrl, { next: { revalidate: 3600 } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: chapterId } = await params;

        if (!chapterId) {
            return NextResponse.json(
                { success: false, message: "Chapter ID is required" },
                { status: 400 }
            );
        }

        const chapter = await db.chapter.findUnique({
            where: { id: chapterId },
            include: {
                story: {
                    select: {
                        id: true,
                        title: true,
                        slug: true,
                        author: true,
                        coverImage: true,
                    }
                }
            }
        });

        if (!chapter) {
            return NextResponse.json(
                { success: false, message: "Chapter not found" },
                { status: 404 }
            );
        }

        // Đọc content: disk (chapter mới) hoặc HTTP/R2 (chapter cũ)
        let content = '';
        if (chapter.contentUrl) {
            try {
                content = await fetchChapterContent(chapter.contentUrl);
            } catch (e) {
                console.error('Failed to fetch chapter content:', chapter.contentUrl, e);
            }
        }

        return NextResponse.json({
            success: true,
            data: {
                ...chapter,
                content, // trả về content để client dùng như cũ
            },
        });
    } catch (error) {
        console.error(`Error fetching chapter API:`, error);
        return NextResponse.json(
            { success: false, message: "Internal server error" },
            { status: 500 }
        );
    }
}
