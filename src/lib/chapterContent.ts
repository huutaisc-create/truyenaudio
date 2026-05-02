import { readFile } from "fs/promises";
import path from "path";

const CHAPTERS_ROOT =
    process.env.CHAPTERS_STORAGE_PATH ??
    `${process.cwd()}/public/chapters`;

/**
 * Đọc nội dung chapter — hỗ trợ cả disk lẫn R2/HTTP:
 *   - contentUrl bắt đầu bằng "/chapters/" → đọc file từ disk (Contabo)
 *   - contentUrl là URL tuyệt đối → HTTP fetch (R2 hoặc CDN cũ)
 */
export async function fetchChapterContent(contentUrl: string | null): Promise<string> {
    if (!contentUrl) return '';

    // Disk path: /chapters/<slug>/<index>.txt
    if (contentUrl.startsWith("/chapters/")) {
        try {
            const relativePath = contentUrl.slice("/chapters/".length);
            const filePath = path.join(CHAPTERS_ROOT, relativePath);
            return await readFile(filePath, "utf-8");
        } catch (e) {
            console.error("fetchChapterContent disk error:", contentUrl, e);
            return '';
        }
    }

    // HTTP fetch (R2, CDN, ...)
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const res = await fetch(contentUrl, {
                next: { revalidate: 3600 },
                signal: AbortSignal.timeout(8000),
            });
            if (!res.ok) continue;
            const text = await res.text();
            if (text.trim()) return text;
        } catch {}
        if (attempt === 0) await new Promise(r => setTimeout(r, 500));
    }
    return '';
}
