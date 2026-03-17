'use client';

import { useState, useRef, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Upload, Check, ArrowLeft, Loader2, Camera } from 'lucide-react';

const DEFAULT_AVATARS = Array.from({ length: 25 }, (_, i) => `/avatars/${i + 1}.webp`);

export default function CaiDatPage() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [selected, setSelected] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Sync selected với session.user.image khi session load xong
  useEffect(() => {
    if (session?.user?.image && !selected) {
      setSelected(session.user.image);
    }
  }, [session?.user?.image]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreviewUrl(URL.createObjectURL(file));
    setUploading(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'avatar');
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) {
        setSelected(data.url);
        setPreviewUrl(null);
        setMessage({ type: 'success', text: `✓ Upload thành công — đã nén xuống ${Math.round(data.size / 1024)}KB` });
      } else {
        setMessage({ type: 'error', text: data.message || 'Upload thất bại' });
        setPreviewUrl(null);
      }
    } catch {
      setMessage({ type: 'error', text: 'Lỗi kết nối' });
      setPreviewUrl(null);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: selected }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: '✓ Đã lưu! Đang cập nhật...' });
        // Gọi update() để NextAuth re-fetch JWT từ DB (bao gồm image mới)
        await update();
        // Refresh server components rồi redirect
        router.refresh();
        setTimeout(() => router.push('/tai-khoan'), 600);
      } else {
        setMessage({ type: 'error', text: data.error || 'Lưu thất bại' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Lỗi kết nối' });
    } finally {
      setSaving(false);
    }
  };

  // Không dùng session?.user?.image trực tiếp vì có thể là giá trị cũ chưa refresh
  const currentImage = previewUrl || selected;
  const ORANGE = '#f97316';

  return (
    <div className="min-h-screen ">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10 max-w-2xl">

        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.back()} className="p-2 rounded-full hover:bg-zinc-100 text-zinc-500 transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-zinc-800">Ảnh đại diện</h1>
            <p className="text-sm text-zinc-500">Chọn từ bộ sưu tập hoặc tải ảnh của bạn lên</p>
          </div>
        </div>

        {/* Preview */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative group cursor-pointer" onClick={() => fileRef.current?.click()}>
            <div className="h-28 w-28 rounded-full overflow-hidden bg-zinc-100 shadow-lg" style={{ border: `3px solid ${ORANGE}` }}>
              {currentImage ? (
                <img
                  src={currentImage}
                  alt="Avatar"
                  className="h-full w-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-4xl font-black text-zinc-300">
                  {session?.user?.name?.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="h-6 w-6 text-white" />
            </div>
            {uploading && (
              <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                <Loader2 className="h-6 w-6 text-white animate-spin" />
              </div>
            )}
          </div>
          <p className="text-sm font-bold text-zinc-700 mt-3">{session?.user?.name}</p>
          {selected && selected !== session?.user?.image && !previewUrl && (
            <p className="text-xs mt-1 font-medium" style={{ color: ORANGE }}>Chưa lưu — nhấn Lưu để cập nhật</p>
          )}
        </div>

        {/* Upload từ máy */}
        <div className="mb-8">
          <h2 className="text-sm font-bold text-zinc-700 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Upload className="h-4 w-4" style={{ color: ORANGE }} /> Tải ảnh từ máy tính
          </h2>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="w-full flex items-center justify-center gap-3 p-4 border-2 border-dashed border-zinc-200 rounded-xl text-zinc-500 hover:border-orange-400 hover:text-orange-500 transition-all"
          >
            {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
            <span className="text-sm font-medium">{uploading ? 'Đang xử lý...' : 'Chọn ảnh JPG / PNG / WebP'}</span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          <p className="text-xs text-zinc-400 mt-2 text-center">Tối đa 5MB · Tự động resize và nén về 200×200px WebP</p>
        </div>

        {/* Grid 5x5 */}
        <div className="mb-8">
          <h2 className="text-sm font-bold text-zinc-700 uppercase tracking-wider mb-4 flex items-center gap-2">
            <span style={{ color: ORANGE }}>✦</span> Bộ sưu tập tu tiên
            <span className="text-xs font-normal text-zinc-400">(25 avatar)</span>
          </h2>
          <div className="grid grid-cols-5 gap-3">
            {DEFAULT_AVATARS.map((avatar, idx) => {
              const isSelected = selected === avatar;
              return (
                <button
                  key={avatar}
                  onClick={() => { setSelected(avatar); setMessage(null); }}
                  className="relative aspect-square rounded-full overflow-hidden transition-all hover:scale-105 focus:outline-none"
                  style={{
                    border: isSelected ? `3px solid ${ORANGE}` : '3px solid #e4e4e7',
                    boxShadow: isSelected ? `0 0 14px ${ORANGE}55` : 'none',
                  }}
                  title={`Avatar ${idx + 1}`}
                >
                  <img
                    src={avatar}
                    alt={`Avatar ${idx + 1}`}
                    className="h-full w-full object-cover"
                    style={{ background: '#f4f4f5' }}
                  />
                  {isSelected && (
                    <div className="absolute inset-0 flex items-center justify-center" style={{ background: `${ORANGE}33` }}>
                      <div className="h-5 w-5 rounded-full flex items-center justify-center" style={{ background: ORANGE }}>
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-4 p-3 rounded-xl text-sm font-medium ${
            message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {message.text}
          </div>
        )}

        {/* Lưu */}
        <button
          onClick={handleSave}
          disabled={saving || uploading || !selected}
          className="w-full py-3.5 text-white font-black rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
          style={{ background: ORANGE }}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {saving ? 'Đang lưu...' : 'Lưu ảnh đại diện'}
        </button>

      </div>
    </div>
  );
}
