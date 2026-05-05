import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page        = parseInt(searchParams.get("page")  || "1",  10);
    const limit       = parseInt(searchParams.get("limit") || "10", 10);
    const search      = searchParams.get("search")      || "";
    const status      = searchParams.get("status")      || "";
    const genre       = searchParams.get("genre")       || ""; // filter by genre name
    const sort        = searchParams.get("sort")        || ""; // viewCount | ratingCount | updatedAt
    const excludeSlug = searchParams.get("excludeSlug") || ""; // exclude current story

    const skip = (page - 1) * limit;

    // ── Where conditions ──────────────────────────────────────────────────
    const whereCondition: any = { isHidden: false };

    if (search) {
      whereCondition.title = { contains: search };
    }
    if (status) {
      whereCondition.status = status;
    }
    if (genre) {
      whereCondition.genres = { some: { name: genre } };
    }
    if (excludeSlug) {
      whereCondition.slug = { not: excludeSlug };
    }

    // ── Order by ──────────────────────────────────────────────────────────
    let orderBy: any = { updatedAt: "desc" }; // default
    if (sort === "viewCount")   orderBy = { viewCount:   "desc" };
    if (sort === "ratingCount") orderBy = { ratingCount: "desc" };
    if (sort === "popular")     orderBy = [{ viewCount: "desc" }, { ratingCount: "desc" }];

    // ── Query ──────────────────────────────────────────────────────────────
    const [stories, totalItems] = await Promise.all([
      prisma.story.findMany({
        where: whereCondition,
        skip,
        take: limit,
        select: {
          id:            true,
          slug:          true,
          title:         true,
          author:        true,
          coverImage:    true,
          status:        true,
          totalChapters: true,
          viewCount:     true,
          ratingScore:   true,
          ratingCount:   true,
          likeCount:     true,
          followCount:   true,
          updatedAt:     true,
          genres: {
            select: { name: true },
          },
        },
        orderBy,
      }),
      prisma.story.count({ where: whereCondition }),
    ]);

    // Map genres array → categories array (for Story.fromJson compatibility)
    const mapped = stories.map((s) => ({
      ...s,
      categories: s.genres.map((g: { name: string }) => g.name),
    }));

    const totalPages = Math.ceil(totalItems / limit);

    return NextResponse.json({
      success: true,
      data: mapped,
      meta: { page, limit, totalItems, totalPages },
    });
  } catch (error) {
    console.error("Error fetching stories API:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
