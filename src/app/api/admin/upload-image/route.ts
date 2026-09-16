// src/app/api/admin/upload-image/route.ts
// Upload ảnh bìa truyện lên disk, serve tĩnh qua Next.js tại /covers/<slug>.<ext>
//
// Dùng bởi script admin ngoài repo (import truyện hàng loạt...), không phải web UI
// hay app mobile — auth bằng secret header dùng chung (X-Upload-Secret), không phải
// session admin. Đây là thiết kế có chủ đích, KHÔNG phải lỗ hổng ở việc dùng secret.
//
// Rà soát 2026-09-16 — vá 3 lỗ hổng thật sự:
//  1) Hardcode fallback secret trong code (giống lỗi JWT_SECRET đã vá trước đây) —
//     bỏ fallback, thiếu env = fail-closed (401), không cho phép dùng secret công khai.
//  2) Bypass whitelist MIME: code cũ dùng `ALLOWED_MIME[mime] ?? file.name extension`
//     — mime lạ (hoặc giả header) vẫn lọt qua bằng cách lấy đuôi file client tự đặt,
//     ghi thẳng ra /covers/*.<đuôi bất kỳ> (SVG chứa script, hoặc đuôi thực thi khác).
//     → giờ CHỈ chấp nhận mime nằm trong whitelist, không fallback theo tên file.
//  3) Path traversal qua `slug`: chưa validate, "../../etc/x" từng ghi được ra ngoài
//     thư mục covers/. → giờ bắt buộc slug khớp /^[a-z0-9-]+$/.
//  + Thêm giới hạn dung lượng 8MB (giống /api/upload đã có).

import { NextRequest, NextResponse } from "next/server";

const UPLOAD_SECRET = process.env.UPLOAD_SECRET;

const ALLOWED_MIME: Record<string, string> = {
    "image/jpeg":  "jpg",
    "image/jpg":   "jpg",
    "image/png":   "png",
    "image/webp":  "webp",
    "image/gif":   "gif",
    "image/avif":  "avif",
};

const MAX_BYTES = 8 * 1024 * 1024; // 8MB — ảnh bìa gốc chưa nén, rộng rãi hơn /api/upload
const SLUG_RE = /^[a-z0-9-]+$/;

export async function POST(request: NextRequest) {
    // Auth — fail-closed: thiếu UPLOAD_SECRET trong env thì KHÔNG cho qua bằng bất
    // kỳ giá trị nào (trước đây có fallback hardcode, bỏ luôn cho khớp quy tắc
    // JWT_SECRET đã áp dụng ở auth-helper.ts).
    if (!UPLOAD_SECRET) {
        console.error("upload-image: thiếu UPLOAD_SECRET trong env — từ chối toàn bộ request");
        return NextResponse.json({ success: false, message: "Server misconfigured" }, { status: 500 });
    }
    const secret = request.headers.get("X-Upload-Secret");
    if (!secret || secret !== UPLOAD_SECRET) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    try {
        const formData = await request.formData();
        const file = formData.get("image") as File | null;
        const slug = (formData.get("slug") as string | null)?.trim();

        if (!file || !slug) {
            return NextResponse.json(
                { success: false, message: "Missing required fields: image, slug" },
                { status: 400 }
            );
        }

        // Chặn path traversal — slug chỉ được chữ thường/số/gạch ngang, không '/' '..' v.v.
        if (!SLUG_RE.test(slug)) {
            return NextResponse.json(
                { success: false, message: "slug không hợp lệ (chỉ a-z, 0-9, dấu -)" },
                { status: 400 }
            );
        }

        if (file.size > MAX_BYTES) {
            return NextResponse.json(
                { success: false, message: `File quá lớn, tối đa ${MAX_BYTES / 1024 / 1024}MB` },
                { status: 400 }
            );
        }

        // CHỈ chấp nhận mime nằm trong whitelist — không fallback theo đuôi file
        // client tự khai (đó là lỗ hổng cho phép ghi file .svg/.php/bất kỳ ra đĩa).
        const mime = file.type?.toLowerCase() || "";
        const ext = ALLOWED_MIME[mime];
        if (!ext) {
            return NextResponse.json(
                { success: false, message: `Unsupported image type: ${mime || "(rỗng)"}` },
                { status: 400 }
            );
        }

        const buffer = Buffer.from(await file.arrayBuffer());

        const { writeFile, mkdir } = await import("fs/promises");
        const coversRoot = process.env.UPLOAD_STORAGE_DIR
            ? `${process.env.UPLOAD_STORAGE_DIR}/covers`
            : process.env.COVERS_STORAGE_PATH!;

        await mkdir(coversRoot, { recursive: true });
        const filename = `${slug}.${ext}`;
        await writeFile(`${coversRoot}/${filename}`, buffer);

        const url = `/covers/${filename}`;
        return NextResponse.json({ success: true, url, filename });

    } catch (error: any) {
        console.error("Upload Image Error:", error);
        return NextResponse.json(
            { success: false, message: error.message || "Internal server error" },
            { status: 500 }
        );
    }
}
