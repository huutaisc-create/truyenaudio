import { redirect } from 'next/navigation';

/**
 * Route cũ /truyen/[slug]/chuong-[index] → redirect sang trang nghe
 * Giữ lại để tránh link hỏng cho bookmark/link ngoài.
 */
export default async function OldReadingPage({
    params,
}: {
    params: Promise<{ slug: string; chapter: string }>;
}) {
    const { slug, chapter } = await params;
    const chapterIndex = parseInt(chapter.replace('chuong-', '')) || 1;
    redirect(`/truyen/${slug}/nghe?chuong=${chapterIndex}`);
}
