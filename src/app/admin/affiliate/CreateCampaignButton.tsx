'use client'
import { useState } from 'react';
import { Plus } from 'lucide-react';
import AffiliateCampaignForm from './AffiliateCampaignForm';

export default function CreateCampaignButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-xl border-2 border-dashed border-gray-300 dark:border-zinc-600 flex flex-col items-center justify-center gap-2 p-5 text-gray-400 hover:border-orange-400 hover:text-orange-500 transition-colors min-h-[220px]"
      >
        <Plus className="h-6 w-6" />
        <span className="text-sm font-medium">Thêm chiến dịch</span>
      </button>
      {open && <AffiliateCampaignForm onClose={() => setOpen(false)} />}
    </>
  );
}
