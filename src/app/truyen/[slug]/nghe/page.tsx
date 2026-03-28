import { getStoryBySlug, getChaptersByStoryId, getChapterBySlugAndIndex } from '@/actions/stories';
import { notFound, redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/auth';
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

  const [session, storyData, chapterData] = await Promise.all([
    auth(),
    getStoryBySlug(params.slug),
    getChapterBySlugAndIndex(params.slug, chapterIndex),
  ]);

  if (!storyData || !chapterData) notFound();

  // Yêu cầu đăng nhập để nghe truyện
  if (!session?.user) {
    const callbackUrl = `/truyen/${params.slug}/nghe${sp.chuong ? `?chuong=${sp.chuong}` : ''}`;
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

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
      content,
    },
    storyInfo: {
      id: storyData.id,
      description: storyData.description ?? '',
      status: storyData.status ?? '',
      genres: storyData.genres.map((g: any) => g.name),
      ratingScore: storyData.ratingScore ?? 0,
      ratingCount: storyData.ratingCount ?? 0,
      viewCount: storyData.viewCount ?? 0,
      likeCount: storyData.likeCount ?? 0,
      followCount: storyData.followCount ?? 0,
      nominationCount: (storyData as any).nominationCount ?? 0,
    },
    currentUser: session?.user ? {
      id: session.user.id as string,
      name: session.user.name ?? 'Người dùng',
      image: session.user.image ?? null,
      role: (session.user as any).role ?? 'USER',
    } : null,
  };

  if (isAndroid) return <ListeningMobileAndroid {...props} />;
  return <ListeningClient {...props} />;
}
