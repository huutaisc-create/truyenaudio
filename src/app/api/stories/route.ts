import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    // const genre = searchParams.get("genre") || ""; // Can be implemented if needed

    // Pagination bounds
    const skip = (page - 1) * limit;

    // Filter conditions
    const whereCondition: any = { isHidden: false };
    if (search) {
      whereCondition.title = { contains: search };
    }
    if (status) {
      whereCondition.status = status;
    }

    const [stories, totalItems] = await Promise.all([
      prisma.story.findMany({
        where: whereCondition,
        skip: skip,
        take: limit,
        select: {
          id: true,
          slug: true,
          title: true,
          author: true,
          coverImage: true,
          status: true,
          totalChapters: true,
          viewCount: true,
          ratingScore: true,
          updatedAt: true,
        },
        orderBy: {
          updatedAt: 'desc', // Default to latest updated
        }
      }),
      prisma.story.count({ where: whereCondition }),
    ]);

    const totalPages = Math.ceil(totalItems / limit);

    return NextResponse.json({
      success: true,
      data: stories,
      meta: {
        page,
        limit,
        totalItems,
        totalPages,
      }
    });
  } catch (error) {
    console.error("Error fetching stories API:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
