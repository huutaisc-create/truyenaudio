'use client'
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { deleteAffiliateCampaign } from '@/actions/admin';

export default function DeleteCampaignButton({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  function onDelete() {
    if (!confirm(`Xoá chiến dịch "${name}"?`)) return;
    start(async () => { await deleteAffiliateCampaign(id); router.refresh(); });
  }
  return (
    <button
      onClick={onDelete}
      disabled={pending}
      className="text-xs font-medium rounded-lg px-3 py-1.5 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 flex items-center justify-center gap-1 disabled:opacity-50"
    >
      <Trash2 className="h-3 w-3" /> {pending ? '...' : 'Xoá'}
    </button>
  );
}
