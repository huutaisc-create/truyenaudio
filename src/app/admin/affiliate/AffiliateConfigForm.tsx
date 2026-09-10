'use client'
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateAffiliateConfig } from '@/actions/admin';

export default function AffiliateConfigForm({ config }: { config: any }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      await updateAffiliateConfig(fd);
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2000);
    });
  }

  const box = "rounded-xl ring-1 ring-gray-200 dark:ring-zinc-700 bg-white dark:bg-zinc-800 p-4 space-y-4";
  const chk = "flex items-center gap-2 text-sm text-gray-700 dark:text-zinc-200";
  const numInput = "w-24 rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-1.5 text-sm text-gray-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-orange-400";

  return (
    <form onSubmit={onSubmit} className={box}>
      <label className={chk}>
        <input name="enabled" type="checkbox" defaultChecked={config.enabled} className="rounded" />
        <span><b>Bật hệ thống popup</b> (tắt = không hiện popup nào)</span>
      </label>

      <div className="grid sm:grid-cols-2 gap-3 pt-2 border-t border-gray-100 dark:border-zinc-700">
        <p className="sm:col-span-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Thời điểm hiển thị</p>
        <label className={chk}><input name="onAppOpen" type="checkbox" defaultChecked={config.onAppOpen} className="rounded" /> Khi mở app</label>
        <label className={chk}><input name="onEnterListen" type="checkbox" defaultChecked={config.onEnterListen} className="rounded" /> Khi vào màn nghe</label>
        <label className={chk}><input name="onTabChange" type="checkbox" defaultChecked={config.onTabChange} className="rounded" /> Khi chuyển tab</label>
        <label className={chk}>
          <input name="onAfterChapters" type="checkbox" defaultChecked={config.onAfterChapters} className="rounded" /> Sau khi đọc/nghe số chương:
          <input name="chaptersThreshold" type="number" min="1" defaultValue={config.chaptersThreshold} className={numInput} />
        </label>
      </div>

      <div className="grid sm:grid-cols-3 gap-3 pt-2 border-t border-gray-100 dark:border-zinc-700">
        <p className="sm:col-span-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Nhịp độ &amp; Session</p>
        <label className="text-sm text-gray-700 dark:text-zinc-200">Cooldown (phút)
          <input name="cooldownMinutes" type="number" min="0" defaultValue={config.cooldownMinutes} className={numInput + " block mt-1"} />
        </label>
        <label className="text-sm text-gray-700 dark:text-zinc-200">Session (ngày)
          <input name="sessionDays" type="number" min="1" defaultValue={config.sessionDays} className={numInput + " block mt-1"} />
        </label>
        <label className="text-sm text-gray-700 dark:text-zinc-200">Boost sau hết session (x)
          <input name="expiredWeightBoost" type="number" min="1" defaultValue={config.expiredWeightBoost} className={numInput + " block mt-1"} />
        </label>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button type="submit" disabled={pending} className="rounded-lg px-4 py-2 text-sm font-semibold bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50">{pending ? 'Đang lưu...' : 'Lưu cấu hình'}</button>
        {saved ? <span className="text-sm text-green-600">✓ Đã lưu</span> : null}
      </div>
    </form>
  );
}
