import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { orderGenreNames } from "@/lib/taxonomy";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const { slug } = await params;

        if (!slug) {
            return NextResponse.json(
                { success: false, message: "Story slug is required" },
                { status: 400 }
            );
        }

        const story = await db.story.findFirst({
            where: {
                slug: slug,
                isHidden: false,
            },
            include: {
                genres: {
                    select: { id: true, name: true, type: true },
                },
                reviews: {
                    orderBy: { createdAt: 'desc' },
                    take: 10,
                    select: {
                        id: true,
                        rating: true,
                        content: true,
                        createdAt: true,
                        user: { select: { name: true, image: true } },
                    },
                },
            },
        });

        if (!story) {
            return NextResponse.json(
                { success: false, message: "Story not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            // categories = top-3 tag theo FACET_ORDER (đồng bộ với /api/stories listing)
            // để "Truyện liên quan" so khớp đúng; giữ nguyên `genres` (đủ) cho hiển thị tag.
            data: { ...story, categories: orderGenreNames(story.genres, 3) },
        });
    } catch (error) {
        console.error(`Error fetching story API:`, error);
        return NextResponse.json(
            { success: false, message: "Internal server error" },
            { status: 500 }
        );
    }
}
