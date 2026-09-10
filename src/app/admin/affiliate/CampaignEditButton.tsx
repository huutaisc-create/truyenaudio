'use client'
import { useState } from 'react';
import { Pencil } from 'lucide-react';
import AffiliateCampaignForm from './AffiliateCampaignForm';

export default function CampaignEditButton({ campaign }: { campaign: any }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex-1 text-xs font-medium rounded-lg px-3 py-1.5 bg-gray-100 dark:bg-zinc-700 text-gray-700 dark:text-zinc-200 hover:bg-gray-200 dark:hover:bg-zinc-600 flex items-center justify-center gap-1"
      >
        <Pencil className="h-3 w-3" /> Sửa
      </button>
      {open && <AffiliateCampaignForm campaign={campaign} onClose={() => setOpen(false)} />}
    </>
  );
}
