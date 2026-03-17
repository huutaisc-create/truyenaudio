import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const { slug } = await params;
        const searchParams = request.nextUrl.searchParams;
        const page = parseInt(searchParams.get("page") || "1", 10);
        const limit = parseInt(searchParams.get("limit") || "100", 10); // Usually need more chapters per page
        const sort = searchParams.get("sort") || "asc"; // asc or desc by index

        if (!slug) {
            return NextResponse.json(
                { success: false, message: "Story slug is required" },
                { status: 400 }
            );
        }

        const story = await prisma.story.findUnique({
            where: { slug },
            select: { id: true },
        });

        if (!story) {
            return NextResponse.json(
                { success: false, message: "Story not found" },
                { status: 404 }
            );
        }

        const skip = (page - 1) * limit;

        const [chapters, totalItems] = await Promise.all([
            prisma.chapter.findMany({
                where: { storyId: story.id },
                skip: skip,
                take: limit,
                select: {
                    id: true,
                    index: true,
                    title: true,
                    createdAt: true,
                    viewCount: true,
                    // Explicitly omit `content` because this endpoint is just for listing
                },
                orderBy: {
                    index: sort === "desc" ? "desc" : "asc",
                }
            }),
            prisma.chapter.count({ where: { storyId: story.id } }),
        ]);

        const totalPages = Math.ceil(totalItems / limit);

        return NextResponse.json({
            success: true,
            data: chapters,
            meta: {
                page,
                limit,
                totalItems,
                totalPages,
            }
        });
    } catch (error) {
        console.error(`Error fetching chapters API:`, error);
        return NextResponse.json(
            { success: false, message: "Internal server error" },
            { status: 500 }
        );
    }
}
