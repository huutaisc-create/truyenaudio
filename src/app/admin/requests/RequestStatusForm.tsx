'use client'

import { updateStoryRequest } from "@/actions/admin";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";

const STATUSES = [
    { value: 'PENDING',  label: 'Chờ duyệt' },
    { value: 'APPROVED', label: 'Đã duyệt' },
    { value: 'DONE',     label: 'Đã đăng' },
    { value: 'REJECTED', label: 'Từ chối' },
];

export default function RequestStatusForm({ requestId, currentStatus }: { requestId: string; currentStatus: string }) {
    const router = useRouter();
    const [status, setStatus] = useState(currentStatus);
    const [saving, setSaving] = useState(false);

    async function handleChange(newStatus: string) {
        setStatus(newStatus);
        if (newStatus === currentStatus) return;
        setSaving(true);
        await updateStoryRequest(requestId, newStatus);
        setSaving(false);
        router.refresh();
    }

    return (
        <div className="relative shrink-0">
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
            <select
                value={status}
                onChange={e => handleChange(e.target.value)}
                disabled={saving}
                className="appearance-none rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-gray-700 dark:text-gray-300 text-xs font-medium px-3 py-1.5 pr-7 focus:border-orange-500 focus:outline-none disabled:opacity-50 cursor-pointer"
            >
                {STATUSES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                ))}
            </select>
        </div>
    );
}
