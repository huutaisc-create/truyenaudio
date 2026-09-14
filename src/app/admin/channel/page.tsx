import { Newspaper } from 'lucide-react';
import db from '@/lib/db';
import { requireAdmin, ROLE_ACCESS } from '@/lib/admin-guard';
import CreatePostForm from './CreatePostForm';
import PostActions from './PostActions';

export const dynamic = 'force-dynamic';

const STATUS_META: Record<string, { label: string; cls: string }> = {
  VISIBLE: { label: 'Đang hiện', cls: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' },
  HIDDEN:  { label: 'Đã ẩn',    cls: 'bg-gray-100 text-gray-600 dark:bg-zinc-700 dark:text-zinc-300' },
  DELETED: { label: 'Đã xoá',   cls: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400' },
};

function formatTime(d: Date): string {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(d);
}

export default async function ChannelAdminPage() {
  await requireAdmin(ROLE_ACCESS.channel);

  // Trang quản trị hiện CẢ bài đã ẩn — khác feed công khai — để còn khôi phục được.
  const posts = await db.channelPost.findMany({
    include: { author: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Kênh Tám Chuyện{' '}
          <span className="text-base font-normal text-gray-400">({posts.length})</span>
        </h1>
      </div>

      <CreatePostForm />

      <div className="rounded-xl bg-white dark:bg-zinc-800 ring-1 ring-gray-900/5 dark:ring-white/10 divide-y divide-gray-100 dark:divide-zinc-700/50">
        {posts.length === 0 && (
          <div className="p-8 text-center">
            <Newspaper className="mx-auto h-8 w-8 text-gray-300 dark:text-zinc-600" />
            <p className="mt-2 text-sm text-gray-500 dark:text-zinc-400">
              Chưa có bài đăng nào. Viết bài đầu tiên ở khung phía trên.
            </p>
          </div>
        )}

        {posts.map((post) => {
          const meta = STATUS_META[post.status] ?? STATUS_META.VISIBLE;
          return (
            <div key={post.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.cls}`}>
                      {meta.label}
                    </span>
                    <span className="text-xs text-gray-400">
                      {post.author?.name ?? 'Admin'} · {formatTime(post.createdAt)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-gray-800 dark:text-zinc-200 whitespace-pre-wrap break-words line-clamp-4">
                    {post.content}
                  </p>
                </div>
                <PostActions postId={post.id} status={post.status} />
              </div>

              {post.images.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {post.images.map((url) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={url}
                      src={url}
                      alt=""
                      className="h-20 w-20 rounded-lg object-cover ring-1 ring-gray-200 dark:ring-zinc-700"
                    />
                  ))}
                </div>
              )}

              <div className="flex gap-4 text-xs text-gray-400">
                <span>{post.likeCount} thích</span>
                <span>{post.commentCount} bình luận</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
