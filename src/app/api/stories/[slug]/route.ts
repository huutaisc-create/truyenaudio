import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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

        const story = await prisma.story.findUnique({
            where: {
                slug: slug,
            },
            include: {
                genres: {
                    select: {
                        id: true,
                        name: true,
                    }
                },
                // We do not fetch all chapters here to keep payload small.
                // There will be a separate route for chapters list.
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
            data: story,
        });
    } catch (error) {
        console.error(`Error fetching story API:`, error);
        return NextResponse.json(
            { success: false, message: "Internal server error" },
            { status: 500 }
        );
    }
}
