import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

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

        // Fetch content từ R2
        let content = '';
        if (chapter.contentUrl) {
            try {
                const r2Res = await fetch(chapter.contentUrl, {
                    next: { revalidate: 3600 } // cache 1 tiếng
                });
                if (r2Res.ok) {
                    content = await r2Res.text();
                }
            } catch (e) {
                console.error('Failed to fetch content from R2:', e);
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
