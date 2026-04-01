'use client'

import { createVipPlan, updateVipPlan } from "@/actions/admin";
import { useState } from "react";
import { useRouter } from "next/navigation";

const inputCls = "w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:bg-zinc-700 dark:border-zinc-600 dark:text-white focus:border-orange-500 focus:outline-none";

export default function VipPlanForm({ plan, onClose }: { plan?: any; onClose: () => void }) {
    const router = useRouter();
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    async function handleSubmit(formData: FormData) {
        setSaving(true);
        setError("");
        const res = plan ? await updateVipPlan(plan.id, formData) : await createVipPlan(formData);
        setSaving(false);
        if (res?.error) {
            setError(res.error);
        } else {
            router.refresh();
            onClose();
        }
    }

    const b = plan?.benefits as any;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
                <h2 className="font-bold text-gray-900 dark:text-white">{plan ? 'Sửa gói VIP' : 'Tạo gói VIP mới'}</h2>
                <form action={handleSubmit} className="space-y-3">
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Tên gói</label>
                        <input name="name" defaultValue={plan?.name} required className={inputCls} placeholder="VIP 1 tháng" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Giá (VNĐ)</label>
                            <input type="number" name="price" defaultValue={plan?.price ?? 49000} min={0} className={inputCls} />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Số ngày</label>
                            <input type="number" name="durationDays" defaultValue={plan?.durationDays ?? 30} min={1} className={inputCls} />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Thứ tự hiển thị</label>
                        <input type="number" name="sortOrder" defaultValue={plan?.sortOrder ?? 0} className={inputCls} />
                    </div>
                    <div className="space-y-2 pt-1">
                        <p className="text-xs font-semibold text-gray-500">Quyền lợi</p>
                        {[
                            { key: 'noAds', label: 'Ẩn quảng cáo' },
                            { key: 'offlineUnlimited', label: 'Nghe offline không giới hạn' },
                            { key: 'premiumVoices', label: 'Giọng đọc cao cấp' },
                        ].map(({ key, label }) => (
                            <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                                <input type="checkbox" name={key} defaultChecked={b?.[key] ?? false} className="rounded text-orange-500" />
                                <span className="text-gray-700 dark:text-gray-300">{label}</span>
                            </label>
                        ))}
                    </div>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" name="isActive" defaultChecked={plan?.isActive ?? true} className="rounded text-orange-500" />
                        <span className="text-gray-700 dark:text-gray-300">Kích hoạt gói</span>
                    </label>

                    {error && <p className="text-xs text-red-500">{error}</p>}

                    <div className="flex gap-2 pt-2">
                        <button type="button" onClick={onClose} className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                            Hủy
                        </button>
                        <button type="submit" disabled={saving} className="flex-1 rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50">
                            {saving ? 'Đang lưu...' : 'Lưu'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
