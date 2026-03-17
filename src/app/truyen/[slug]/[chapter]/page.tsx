import React from 'react';
import { getChapterBySlugAndIndex, getChaptersByStoryId, getStoryBySlug } from '@/actions/stories';
import ReadingClient from './ReadingClient';

// Helper: fetch content từ R2
async function fetchContentFromR2(contentUrl: string | null): Promise<string> {
    if (!contentUrl) return '';
    try {
        const res = await fetch(contentUrl, { next: { revalidate: 3600 } });
        if (!res.ok) return '';
        return await res.text();
    } catch {
        return '';
    }
}

const ReadingPage = async ({ params: paramsPromise }: { params: Promise<{ slug: string; chapter: string }> }) => {
    const params = await paramsPromise;
    const chapterIndex = parseInt(params.chapter.replace('chuong-', ''));

    const data = await getChapterBySlugAndIndex(params.slug, chapterIndex);

    if (!data) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p>Không tìm thấy chương này.</p>
            </div>
        );
    }

    const { storyTitle, storyCover, chapter, prev, next } = data;

    // Fetch song song: auth + storyData + next chapter + content từ R2
    const [{ auth }, storyData, nextData, chapterContent] = await Promise.all([
        import('@/auth'),
        getStoryBySlug(params.slug),
        next !== null ? getChapterBySlugAndIndex(params.slug, next) : Promise.resolve(null),
        fetchContentFromR2(chapter.contentUrl),
    ]);

    const session = await auth();
    const isEditable = session?.user?.role === 'ADMIN';

    let allChapters: { index: number; title: string }[] = [];
    let storyId = '';
    let totalChapters = 0;
    if (storyData) {
        storyId = storyData.id;
        const chapterData = await getChaptersByStoryId(storyData.id, 1);
        totalChapters = chapterData.total;
        allChapters = chapterData.chapters.map(c => ({
            index: c.index,
            title: c.title || `Chương ${c.index}`,
        }));
    }

    // Fetch next chapter content từ R2 nếu có
    const nextChapterContent = nextData
        ? await fetchContentFromR2(nextData.chapter.contentUrl)
        : '';

    const sanitizedChapter = {
        id: chapter.id,
        index: chapter.index,
        title: chapter.title,
        content: chapterContent, // content từ R2
    };

    const sanitizedNextChapter = nextData ? {
        id: nextData.chapter.id,
        index: nextData.chapter.index,
        title: nextData.chapter.title,
        content: nextChapterContent, // content từ R2
    } : null;

    return (
        <ReadingClient
            slug={params.slug}
            chapter={sanitizedChapter}
            nextChapter={sanitizedNextChapter}
            storyTitle={storyTitle}
            storyCover={storyCover}
            prev={prev}
            next={next}
            isEditable={isEditable}
            allChapters={allChapters}
            storyId={storyId}
            totalChapters={totalChapters}
            userId={session?.user?.id || null}
        />
    );
};

export default ReadingPage;
