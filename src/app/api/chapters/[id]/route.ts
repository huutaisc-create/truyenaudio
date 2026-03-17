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
            where: {
                id: chapterId,
            },
            include: {
                story: {
                    select: {
                        title: true,
                        slug: true,
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

        // Optionally increment view count on the chapter (or story) when fetched.
        // For read-heavy API this should be queued or optimistic, but simple approach is await:
        // await prisma.chapter.update({ where: { id: chapterId }, data: { viewCount: { increment: 1 } } });

        return NextResponse.json({
            success: true,
            data: chapter,
        });
    } catch (error) {
        console.error(`Error fetching chapter API:`, error);
        return NextResponse.json(
            { success: false, message: "Internal server error" },
            { status: 500 }
        );
    }
}
