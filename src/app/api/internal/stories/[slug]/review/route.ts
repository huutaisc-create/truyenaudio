// src/app/api/internal/stories/[slug]/review/route.ts
// Endpoint nội bộ — chỉ dùng cho review.py (local upload tool) để cập nhật aiReview
// Auth: X-Internal-Secret header khớp với UPLOAD_SECRET

import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

const INTERNAL_SECRET =
    process.env.UPLOAD_SECRET ||
    "df5e8753a931894d842645d812d2b23fe89917d87def1633c8926f2c67728a5c";

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    // ── Xác thực ────────────────────────────────────────────────────────────
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

    // ── Parse body ──────────────────────────────────────────────────────────
    let body: { ai_review?: string; secret?: string };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
    }

    const aiReview = body.ai_review;
    if (typeof aiReview !== "string") {
        return NextResponse.json(
            { ok: false, error: "Trường ai_review (string) là bắt buộc" },
            { status: 400 }
        );
    }

    // ── Cập nhật DB ─────────────────────────────────────────────────────────
    try {
        const story = await db.story.findUnique({
            where: { slug },
            select: { id: true, title: true },
        });

        if (!story) {
            return NextResponse.json(
                { ok: false, error: `Không tìm thấy truyện: '${slug}'` },
                { status: 404 }
            );
        }

        await db.story.update({
            where: { slug },
            data:  { aiReview: aiReview || null },
        });

        return NextResponse.json({
            ok:    true,
            slug,
            title: story.title,
            chars: aiReview.length,
            message: `Đã cập nhật aiReview cho '${story.title}' (${aiReview.length} ký tự)`,
        });
    } catch (error: any) {
        console.error("[push-review] DB error:", error);
        return NextResponse.json(
            { ok: false, error: error.message || "Internal server error" },
            { status: 500 }
        );
    }
}
