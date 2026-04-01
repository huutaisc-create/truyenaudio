'use client'

import { addSpamKeyword } from "@/actions/admin";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

export default function AddKeywordForm() {
    const router = useRouter();
    const [keyword, setKeyword] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!keyword.trim()) return;
        setSaving(true);
        setError("");
        const res = await addSpamKeyword(keyword.trim());
        setSaving(false);
        if (res?.error) {
            setError(res.error);
        } else {
            setKeyword("");
            router.refresh();
        }
    }

    return (
        <form onSubmit={handleSubmit} className="flex gap-2">
            <input
                type="text"
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                placeholder="Nhập từ khoá cấm..."
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:bg-zinc-800 dark:border-zinc-700 dark:text-white focus:border-orange-500 focus:outline-none"
            />
            <button
                type="submit"
                disabled={saving || !keyword.trim()}
                className="flex items-center gap-1.5 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50 transition-colors"
            >
                <Plus className="h-4 w-4" />
                {saving ? '...' : 'Thêm'}
            </button>
            {error && <p className="text-xs text-red-500 self-center">{error}</p>}
        </form>
    );
}
