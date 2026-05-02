// D:\Webtruyen\webtruyen-app\src\app\api\admin\stories\route.ts

import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import db from "@/lib/db";

const UPLOAD_SECRET = process.env.UPLOAD_SECRET || "df5e8753a931894d842645d812d2b23fe89917d87def1633c8926f2c67728a5c";

// Thư mục gốc lưu chapter trên disk Contabo
// Mặc định: <app>/public/chapters/ — Next.js tự serve tại /chapters/...
// Có thể override bằng env CHAPTERS_STORAGE_PATH (trỏ đến thư mục Nginx serve)
const CHAPTERS_ROOT = process.env.CHAPTERS_STORAGE_PATH
    ?? `${process.cwd()}/public/chapters`;

async function saveChapterToDisk(slug: string, index: number, content: string): Promise<string> {
    const dir = `${CHAPTERS_ROOT}/${slug}`;
    await mkdir(dir, { recursive: true });
    await writeFile(`${dir}/${index}.txt`, content, "utf-8");
    // Trả về relative URL — chapter API sẽ đọc từ disk thay vì fetch HTTP
    return `/chapters/${slug}/${index}.txt`;
}

export async function POST(request: NextRequest) {
    const secret = request.headers.get("X-Upload-Secret");
    if (!secret || secret !== UPLOAD_SECRET) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { story: s, chapters } = body;

        if (!s?.slug || !s?.title) {
            return NextResponse.json(
                { success: false, message: "Missing required fields: slug, title" },
                { status: 400 }
            );
        }

        // ── Normalize slug (đ/Đ không phân giải được bằng NFD) ─
        const resolvedSlug = s.slug
            .replace(/đ/g, 'd').replace(/Đ/g, 'D')
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

        // ── Normalize status ───────────────────────────────────
        const resolvedStatus =
            s.book_status === "Full"    ? "COMPLETED" :
            s.book_status === "Ongoing" ? "ONGOING"   :
            s.status || "ONGOING";

        const resolvedCover = (s.cover_url || s.coverImage || "").trim();

        // ── Gom tất cả tags theo đúng type ────────────────────
        const buildTags = (names: string[] | string | undefined, type: string) => {
            if (!names) return [];
            const arr = Array.isArray(names)
                ? names
                : names.split(/[,，、]/).map((g: string) => g.trim()).filter(Boolean);
            return arr.map(name => ({ name, type }));
        };

        const allTags = [
            ...buildTags(s.genres   || s.category, "GENRE"),
            ...buildTags(s.boiCanh,                "BOI_CANH"),
            ...buildTags(s.luuPhai,                "LUU_PHAI"),
            ...buildTags(s.tinhCach,               "TINH_CACH"),
            ...buildTags(s.thiGiac,                "THI_GIAC"),
        ];

        // ── Upsert từng Genre theo (name, type) ───────────────
        const genreIds: { id: string }[] = await Promise.all(
            allTags.map(async ({ name, type }) => {
                const genre = await db.genre.upsert({
                    where:  { name_type: { name, type } },
                    update: {},
                    create: { name, type },
                });
                return { id: genre.id };
            })
        );

        // ── Upsert Story ───────────────────────────────────────
        const story = await db.story.upsert({
            where:  { slug: resolvedSlug },
            update: {
                title:         s.title,
                author:        s.author        || "Unknown",
                description:   s.description   || "",
                // Chỉ cập nhật coverImage nếu có — tránh batch sau overwrite "" vào DB
                ...(resolvedCover ? { coverImage: resolvedCover } : {}),
                status:        resolvedStatus,
                viewCount:     s.viewCount  ?? s.view_count  ?? 0,
                likeCount:     s.likeCount  ?? s.like_count  ?? 0,
                followCount:   s.followCount ?? s.follow_count ?? 0,
                ratingScore:   s.ratingScore   ?? 0,
                ratingCount:   s.ratingCount   ?? 0,
                updatedAt:     new Date(),
                ...(genreIds.length > 0 && {
                    genres: { set: genreIds }
                }),
            },
            create: {
                slug:          resolvedSlug,
                title:         s.title,
                author:        s.author        || "Unknown",
                description:   s.description   || "",
                coverImage:    resolvedCover,
                status:        resolvedStatus,
                totalChapters: 0,
                viewCount:     s.viewCount  ?? s.view_count  ?? 0,
                likeCount:     s.likeCount  ?? s.like_count  ?? 0,
                followCount:   s.followCount ?? s.follow_count ?? 0,
                ratingScore:   s.ratingScore   ?? 0,
                ratingCount:   s.ratingCount   ?? 0,
                ...(genreIds.length > 0 && {
                    genres: { connect: genreIds }
                }),
            },
        });

        // ── Insert chapters mới (bỏ qua index đã có) ──────────
        let insertedCount = 0;

        if (Array.isArray(chapters) && chapters.length > 0) {
            const existing = await db.chapter.findMany({
                where:  { storyId: story.id },
                select: { index: true },
            });
            const existingSet = new Set(existing.map((c) => c.index));

            const newChapters = chapters.filter((c: any) => !existingSet.has(c.index));

            for (const c of newChapters) {
                // Lưu content vào disk Contabo
                const content = c.content || "";
                const contentUrl = content
                    ? await saveChapterToDisk(resolvedSlug, c.index, content)
                    : null;

                await db.chapter.create({
                    data: {
                        storyId:    story.id,
                        index:      c.index,
                        title:      c.title || `Chương ${c.index}`,
                        contentUrl,
                    }
                });
            }
            insertedCount = newChapters.length;

            // Cập nhật totalChapters theo thực tế
            const actualTotal = await db.chapter.count({ where: { storyId: story.id } });
            await db.story.update({
                where: { id: story.id },
                data:  { totalChapters: actualTotal },
            });
        }

        return NextResponse.json({
            success:     true,
            message:     `Uploaded ${insertedCount} new chapters for "${s.title}"`,
            storyId:     story.id,
            inserted:    insertedCount,
            newChapters: insertedCount,
        });

    } catch (error: any) {
        console.error("Upload API Error:", error);
        return NextResponse.json(
            { success: false, message: error.message || "Internal server error" },
            { status: 500 }
        );
    }
}
