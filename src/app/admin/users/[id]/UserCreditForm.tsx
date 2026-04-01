'use client'

import { adjustUserCredit } from "@/actions/admin";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function UserCreditForm({ userId, currentBalance }: { userId: string; currentBalance: number }) {
    const router = useRouter();
    const [amount, setAmount] = useState("");
    const [note, setNote] = useState("");
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

    const parsedAmount = parseFloat(amount);
    const preview = !isNaN(parsedAmount) ? Math.max(0, currentBalance + parsedAmount) : null;

    async function handleSave() {
        if (isNaN(parsedAmount) || parsedAmount === 0) return;
        if (!confirm(`${parsedAmount > 0 ? 'Thêm' : 'Trừ'} ${Math.abs(parsedAmount)} credit?`)) return;
        setSaving(true);
        setMsg(null);
        const res = await adjustUserCredit(userId, parsedAmount, note);
        setSaving(false);
        if (res?.error) {
            setMsg({ type: 'err', text: res.error });
        } else {
            setMsg({ type: 'ok', text: `Thành công! Số dư mới: ${res.newBalance?.toFixed(1)}` });
            setAmount("");
            setNote("");
            router.refresh();
        }
    }

    return (
        <div className="space-y-3">
            <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Số lượng <span className="text-gray-400">(dương = cộng, âm = trừ)</span>
                </label>
                <input
                    type="number"
                    step="0.5"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="VD: 5 hoặc -2"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:bg-zinc-700 dark:border-zinc-600 dark:text-white focus:border-orange-500 focus:outline-none"
                />
                {preview !== null && (
                    <p className="text-xs text-gray-400 mt-1">
                        {currentBalance.toFixed(1)} → <span className={parsedAmount >= 0 ? 'text-green-500' : 'text-red-400'}>{preview.toFixed(1)}</span>
                    </p>
                )}
            </div>
            <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Ghi chú (tùy chọn)</label>
                <input
                    type="text"
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="Lý do điều chỉnh..."
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:bg-zinc-700 dark:border-zinc-600 dark:text-white focus:border-orange-500 focus:outline-none"
                />
            </div>
            <button
                onClick={handleSave}
                disabled={saving || !amount || isNaN(parsedAmount) || parsedAmount === 0}
                className="w-full rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50 transition-colors"
            >
                {saving ? 'Đang lưu...' : 'Xác nhận điều chỉnh'}
            </button>
            {msg && (
                <p className={`text-xs ${msg.type === 'ok' ? 'text-green-500' : 'text-red-500'}`}>{msg.text}</p>
            )}
        </div>
    );
}
