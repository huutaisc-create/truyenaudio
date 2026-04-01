'use client'

import { updateUserRole } from "@/actions/admin";
import { useState } from "react";
import { useRouter } from "next/navigation";

const ALL_ROLES = [
    { value: 'USER',      label: 'User' },
    { value: 'ADMIN',     label: 'Admin' },
    { value: 'EDITOR',    label: 'Editor' },
    { value: 'FINANCE',   label: 'Finance' },
    { value: 'MODERATOR', label: 'Moderator' },
    { value: 'SUPPORT',   label: 'Support' },
];

export default function UserRoleForm({ userId, currentRole }: { userId: string; currentRole: string }) {
    const router = useRouter();
    const [role, setRole] = useState(currentRole);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

    async function handleSave() {
        if (role === currentRole) return;
        if (!confirm(`Đổi role sang "${role}"?`)) return;
        setSaving(true);
        setMsg(null);
        const res = await updateUserRole(userId, role);
        setSaving(false);
        if (res?.error) {
            setMsg({ type: 'err', text: res.error });
        } else {
            setMsg({ type: 'ok', text: 'Đã cập nhật role!' });
            router.refresh();
        }
    }

    return (
        <div className="space-y-3">
            <select
                value={role}
                onChange={e => setRole(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:bg-zinc-700 dark:border-zinc-600 dark:text-white focus:border-orange-500 focus:outline-none"
            >
                {ALL_ROLES.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                ))}
            </select>
            <button
                onClick={handleSave}
                disabled={saving || role === currentRole}
                className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
                {saving ? 'Đang lưu...' : 'Lưu Role'}
            </button>
            {msg && (
                <p className={`text-xs ${msg.type === 'ok' ? 'text-green-500' : 'text-red-500'}`}>{msg.text}</p>
            )}
        </div>
    );
}
