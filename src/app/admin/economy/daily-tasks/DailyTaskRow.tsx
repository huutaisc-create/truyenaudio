'use client'

import { upsertDailyTask } from "@/actions/admin";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DailyTaskRow({ task }: { task: any }) {
    const router = useRouter();
    const [reward, setReward] = useState<string>(String(task.creditReward));
    const [active, setActive] = useState<boolean>(task.isActive);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    async function handleSave() {
        setSaving(true);
        await upsertDailyTask(task.taskKey, task.label, task.description ?? '', parseFloat(reward) || 0, active);
        setSaving(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        router.refresh();
    }

    const dirty = String(task.creditReward) !== reward || task.isActive !== active;

    return (
        <div className="flex items-center gap-4 px-5 py-4">
            {/* Toggle */}
            <button
                type="button"
                onClick={() => setActive(!active)}
                className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${active ? 'bg-orange-500' : 'bg-gray-300 dark:bg-zinc-600'}`}
            >
                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform mt-0.5 ${active ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{task.label}</p>
                <p className="text-xs text-gray-400">{task.description}</p>
                <p className="text-[10px] text-orange-400 font-mono mt-0.5">{task.taskKey}</p>
            </div>

            {/* Reward input */}
            <div className="flex items-center gap-1.5 shrink-0">
                <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={reward}
                    onChange={e => setReward(e.target.value)}
                    className="w-16 rounded-md border border-gray-300 px-2 py-1 text-sm text-center dark:bg-zinc-700 dark:border-zinc-600 dark:text-white focus:border-orange-500 focus:outline-none"
                />
                <span className="text-xs text-gray-400">credit</span>
            </div>

            {/* Save */}
            <button
                onClick={handleSave}
                disabled={saving || !dirty}
                className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    saved ? 'bg-green-100 text-green-700' :
                    dirty ? 'bg-orange-500 text-white hover:bg-orange-600' :
                    'bg-gray-100 text-gray-400 cursor-default'
                } disabled:opacity-50`}
            >
                {saving ? '...' : saved ? 'Đã lưu ✓' : 'Lưu'}
            </button>
        </div>
    );
}
