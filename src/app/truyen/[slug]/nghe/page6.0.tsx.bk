import { getStoryBySlug, getChaptersByStoryId, getChapterBySlugAndIndex } from '@/actions/stories';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import ListeningClient from './ListeningClient';
import ListeningMobileAndroid from './ListeningMobileAndroid';

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ chuong?: string }>;
}

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

export default async function ListeningPage({ params: paramsPromise, searchParams: spPromise }: Props) {
  const params = await paramsPromise;
  const sp = await spPromise;
  const chapterIndex = sp.chuong ? parseInt(sp.chuong) : 1;

  // Detect device từ User-Agent
  const ua = (await headers()).get('user-agent') ?? '';
  const isAndroid = /Android/i.test(ua);

  const [storyData, chapterData] = await Promise.all([
    getStoryBySlug(params.slug),
    getChapterBySlugAndIndex(params.slug, chapterIndex),
  ]);

  if (!storyData || !chapterData) notFound();

  const [chaptersResult, content] = await Promise.all([
    getChaptersByStoryId(storyData.id, 1),
    fetchContentFromR2(chapterData.chapter.contentUrl),
  ]);

  const initialChapters = chaptersResult.chapters.map((c) => ({
    id: c.id,
    index: c.index,
    title: c.title || `Chương ${c.index}`,
  }));

  const props = {
    slug: params.slug,
    storyId: storyData.id,
    storyTitle: storyData.title,
    storyCover: storyData.coverImage ?? null,
    author: storyData.author ?? 'Đang cập nhật',
    totalChapters: chaptersResult.total,
    initialChapters,
    initialChapterIndex: chapterIndex,
    initialChapter: {
      id: chapterData.chapter.id,
      index: chapterData.chapter.index,
      title: chapterData.chapter.title,
      content, // content từ R2
    },
  };

  if (isAndroid) return <ListeningMobileAndroid {...props} />;
  return <ListeningClient {...props} />;
}
