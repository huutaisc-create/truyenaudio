'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

/**
 * Ẩn / hiện lại một bài đăng.
 *
 * Cố ý KHÔNG có nút xoá vĩnh viễn: bài bị xoá cứng sẽ kéo theo toàn bộ bình luận
 * của người dùng dưới đó (khoá ngoại CASCADE). Ẩn là đủ để gỡ khỏi feed mà vẫn
 * giữ lại nội dung nếu cần xem lại.
 */
export default function PostActions({ postId, status }: { postId: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const hidden = status !== 'VISIBLE';

  async function toggle() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/channel/posts/${postId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: hidden ? 'VISIBLE' : 'HIDDEN' }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      title={hidden ? 'Hiện lại bài này' : 'Ẩn bài này khỏi feed'}
      className="shrink-0 flex items-center gap-1.5 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : hidden ? (
        <Eye className="h-3.5 w-3.5" />
      ) : (
        <EyeOff className="h-3.5 w-3.5" />
      )}
      {hidden ? 'Hiện' : 'Ẩn'}
    </button>
  );
}
