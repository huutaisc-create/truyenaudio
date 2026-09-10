'use client'
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { createAffiliateCampaign, updateAffiliateCampaign } from '@/actions/admin';

function toLocalInput(v?: string | null) {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AffiliateCampaignForm({ campaign, onClose }: { campaign?: any; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState('');
  const [preview, setPreview] = useState(campaign?.imageUrl || '');

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = campaign
        ? await updateAffiliateCampaign(campaign.id, fd)
        : await createAffiliateCampaign(fd);
      if (res?.error) setErr(res.error);
      else { router.refresh(); onClose(); }
    });
  }

  const input = "w-full rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-gray-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-orange-400";
  const label = "block text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-zinc-800 p-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">{campaign ? 'Sửa chiến dịch' : 'Thêm chiến dịch'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className={label}>Tên chiến dịch</label>
            <input name="name" defaultValue={campaign?.name || ''} required className={input} />
          </div>
          <div>
            <label className={label}>URL ảnh banner</label>
            <input name="imageUrl" defaultValue={campaign?.imageUrl || ''} placeholder="https://..." className={input} onChange={(e) => setPreview(e.target.value)} />
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="preview" className="mt-2 w-full h-28 object-cover rounded-lg bg-gray-100 dark:bg-zinc-700" />
            ) : null}
          </div>
          <div>
            <label className={label}>Link affiliate (target)</label>
            <input name="targetUrl" defaultValue={campaign?.targetUrl || ''} placeholder="https://..." required className={input} />
          </div>
          <div>
            <label className={label}>Câu incentive (tuỳ chọn)</label>
            <input name="incentiveText" defaultValue={campaign?.incentiveText || ''} placeholder="Click nhận voucher để nghe không gián đoạn" className={input} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Tỷ trọng (weight)</label>
              <input name="weight" type="number" min="1" defaultValue={campaign?.weight ?? 1} className={input} />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-zinc-200">
                <input name="isActive" type="checkbox" defaultChecked={campaign ? campaign.isActive : true} className="rounded" />
                Bật hiển thị
              </label>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Bắt đầu (tuỳ chọn)</label>
              <input name="startAt" type="datetime-local" defaultValue={toLocalInput(campaign?.startAt)} className={input} />
            </div>
            <div>
              <label className={label}>Kết thúc (tuỳ chọn)</label>
              <input name="endAt" type="datetime-local" defaultValue={toLocalInput(campaign?.endAt)} className={input} />
            </div>
          </div>
          {err ? <p className="text-sm text-red-500">{err}</p> : null}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-gray-600 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-700">Huỷ</button>
            <button type="submit" disabled={pending} className="rounded-lg px-4 py-2 text-sm font-semibold bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50">{pending ? 'Đang lưu...' : 'Lưu'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
