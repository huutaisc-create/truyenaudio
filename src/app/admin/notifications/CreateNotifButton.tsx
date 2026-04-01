'use client'

import { createPushNotification } from "@/actions/admin";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";

const inputCls = "w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:bg-zinc-700 dark:border-zinc-600 dark:text-white focus:border-orange-500 focus:outline-none";

export default function CreateNotifButton() {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    async function handleSubmit(formData: FormData) {
        setSaving(true);
        setError("");
        const res = await createPushNotification(formData);
        setSaving(false);
        if (res?.error) {
            setError(res.error);
        } else {
            setOpen(false);
            router.refresh();
        }
    }

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 transition-colors"
            >
                <Plus className="h-4 w-4" />
                Tạo thông báo
            </button>

            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="font-bold text-gray-900 dark:text-white">Tạo thông báo mới</h2>
                            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <form action={handleSubmit} className="space-y-3">
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Tiêu đề</label>
                                <input name="title" required className={inputCls} placeholder="Tiêu đề thông báo" />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Nội dung</label>
                                <textarea name="body" required rows={3} className={inputCls} placeholder="Nội dung thông báo..." />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Gửi tới</label>
                                <select name="targetType" className={inputCls}>
                                    <option value="ALL">Tất cả user</option>
                                    <option value="VIP">Chỉ VIP</option>
                                </select>
                            </div>

                            <div className="rounded-lg bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/20 p-3">
                                <p className="text-xs text-yellow-700 dark:text-yellow-400">
                                    ⚠️ Thông báo sẽ được lưu ở trạng thái <strong>Nháp</strong>. Tích hợp gửi thực (FCM) sẽ triển khai riêng.
                                </p>
                            </div>

                            {error && <p className="text-xs text-red-500">{error}</p>}

                            <div className="flex gap-2 pt-1">
                                <button type="button" onClick={() => setOpen(false)} className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                                    Hủy
                                </button>
                                <button type="submit" disabled={saving} className="flex-1 rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50">
                                    {saving ? 'Đang lưu...' : 'Lưu nháp'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
