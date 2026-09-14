'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ImagePlus, Loader2, Send, X } from 'lucide-react';

const MAX_IMAGES = 10;
const MAX_LEN = 5000;

interface Picked {
  file: File;
  preview: string; // blob: URL, chỉ để xem trước tại chỗ
}

export default function CreatePostForm() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);

  const [content, setContent] = useState('');
  const [picked, setPicked] = useState<Picked[]>([]);
  const [sendPush, setSendPush] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  function addFiles(files: FileList | null) {
    if (!files) return;
    const room = MAX_IMAGES - picked.length;
    if (room <= 0) {
      setError(`Tối đa ${MAX_IMAGES} ảnh mỗi bài.`);
      return;
    }
    const next = Array.from(files)
      .slice(0, room)
      .map((file) => ({ file, preview: URL.createObjectURL(file) }));
    setPicked((p) => [...p, ...next]);
    setError('');
  }

  function removeAt(i: number) {
    setPicked((p) => {
      URL.revokeObjectURL(p[i].preview); // trả bộ nhớ, đừng để rò blob
      return p.filter((_, idx) => idx !== i);
    });
  }

  function reset() {
    picked.forEach((p) => URL.revokeObjectURL(p.preview));
    setPicked([]);
    setContent('');
    setStatus('');
    if (fileInput.current) fileInput.current.value = '';
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = content.trim();
    if (!text) {
      setError('Nội dung không được để trống.');
      return;
    }
    if (text.length > MAX_LEN) {
      setError(`Nội dung tối đa ${MAX_LEN} ký tự.`);
      return;
    }

    setBusy(true);
    setError('');

    try {
      // Ảnh tải lên TRƯỚC, lấy URL rồi mới tạo bài. Làm ngược lại sẽ có bài đăng
      // trống ảnh nằm lại trên feed nếu bước tải ảnh hỏng giữa chừng.
      const urls: string[] = [];
      for (let i = 0; i < picked.length; i++) {
        setStatus(`Đang tải ảnh ${i + 1}/${picked.length}...`);
        const fd = new FormData();
        fd.append('file', picked[i].file);
        fd.append('type', 'post');
        const res = await fetch('/api/upload', { method: 'POST', body: fd });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.success || !json?.url) {
          throw new Error(json?.message || `Tải ảnh thứ ${i + 1} thất bại`);
        }
        urls.push(json.url as string);
      }

      setStatus('Đang đăng bài...');
      const res = await fetch('/api/admin/channel/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text, images: urls, sendPush }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || `Đăng bài thất bại (lỗi ${res.status})`);
      }

      reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Có lỗi xảy ra');
      setStatus('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl bg-white dark:bg-zinc-800 ring-1 ring-gray-900/5 dark:ring-white/10 p-4 space-y-3"
    >
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={4}
        maxLength={MAX_LEN}
        placeholder="Viết gì đó cho bạn đọc..."
        className="w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm dark:bg-zinc-700 dark:border-zinc-600 dark:text-white focus:border-orange-500 focus:outline-none"
      />

      {picked.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {picked.map((p, i) => (
            <div key={p.preview} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.preview}
                alt=""
                className="h-20 w-20 rounded-lg object-cover ring-1 ring-gray-200 dark:ring-zinc-700"
              />
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="absolute -right-1.5 -top-1.5 rounded-full bg-gray-900/80 p-0.5 text-white hover:bg-red-500"
                aria-label="Bỏ ảnh này"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={busy || picked.length >= MAX_IMAGES}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            <ImagePlus className="h-4 w-4" />
            Thêm ảnh
            {picked.length > 0 && <span className="text-xs text-gray-400">({picked.length}/{MAX_IMAGES})</span>}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => addFiles(e.target.files)}
          />

          <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-zinc-300 select-none">
            <input
              type="checkbox"
              checked={sendPush}
              onChange={(e) => setSendPush(e.target.checked)}
              className="h-4 w-4 accent-orange-500"
            />
            Gửi thông báo đẩy
          </label>
        </div>

        <button
          type="submit"
          disabled={busy}
          className="flex items-center gap-1.5 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {busy ? 'Đang xử lý...' : 'Đăng bài'}
        </button>
      </div>

      {sendPush && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Bài này sẽ bắn thông báo tới <strong>mọi thiết bị</strong> đã cài app. Cân nhắc tắt
          với bài nhỏ — push quá nhiều là lý do phổ biến khiến người dùng tắt thông báo vĩnh viễn.
        </p>
      )}

      {status && !error && <p className="text-xs text-gray-500 dark:text-zinc-400">{status}</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </form>
  );
}
