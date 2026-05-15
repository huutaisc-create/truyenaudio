// src/app/api/internal/stories/[slug]/status/route.ts
// Endpoint nội bộ — cập nhật tình trạng truyện (Ongoing/Full) từ review.py
// Auth: X-Internal-Secret header

import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

const INTERNAL_SECRET =
    process.env.UPLOAD_SECRET ||
    "df5e8753a931894d842645d812d2b23fe89917d87def1633c8926f2c67728a5c";

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    const secret =
        request.headers.get("X-Internal-Secret") ||
        request.headers.get("X-Upload-Secret");
    if (!secret || secret !== INTERNAL_SECRET) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { slug } = await params;
    if (!slug) {
        return NextResponse.json({ ok: false, error: "Missing slug" }, { status: 400 });
    }

    let body: { book_status?: string };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
    }

    const bookStatus = body.book_status;
    if (!bookStatus || !["Ongoing", "Full"].includes(bookStatus)) {
        return NextResponse.json(
            { ok: false, error: "book_status phải là 'Ongoing' hoặc 'Full'" },
            { status: 400 }
        );
    }

    const resolvedStatus = bookStatus === "Full" ? "COMPLETED" : "ONGOING";

    try {
        const story = await db.story.findUnique({
            where: { slug },
            select: { id: true, title: true, status: true },
        });

        if (!story) {
            return NextResponse.json(
                { ok: false, error: `Không tìm thấy truyện: '${slug}'` },
                { status: 404 }
            );
        }

        await db.story.update({
            where: { slug },
            data:  { status: resolvedStatus },
        });

        return NextResponse.json({
            ok:      true,
            slug,
            title:   story.title,
            before:  story.status,
            after:   resolvedStatus,
            message: `Đã cập nhật tình trạng '${story.title}': ${story.status} → ${resolvedStatus}`,
        });
    } catch (error: any) {
        console.error("[push-status] DB error:", error);
        return NextResponse.json(
            { ok: false, error: error.message || "Internal server error" },
            { status: 500 }
        );
    }
}
