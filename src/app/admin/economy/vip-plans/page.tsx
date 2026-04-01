import { getVipPlans, deleteVipPlan } from "@/actions/admin";
import { Check, X } from "lucide-react";
import { redirect } from "next/navigation";
import Link from "next/link";
import VipPlanEditButton from "./VipPlanEditButton";
import CreateVipPlanButton from "./CreateVipPlanButton";

export default async function VipPlansPage() {
    const plans = await getVipPlans();

    async function handleDelete(id: string) {
        "use server"
        await deleteVipPlan(id);
        redirect('/admin/economy/vip-plans');
    }

    return (
        <div className="space-y-6 max-w-4xl">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Gói VIP</h1>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {plans.map((plan: any) => {
                    const b = plan.benefits as any;
                    return (
                        <div key={plan.id} className={`rounded-xl ring-1 p-5 bg-white dark:bg-zinc-800 ${plan.isActive ? 'ring-orange-300 dark:ring-orange-500/40' : 'ring-gray-200 dark:ring-zinc-700 opacity-60'}`}>
                            <div className="flex items-start justify-between mb-3">
                                <div>
                                    <p className="font-bold text-gray-900 dark:text-white">{plan.name}</p>
                                    <p className="text-2xl font-black text-orange-500 mt-1">
                                        {plan.price.toLocaleString('vi-VN')}₫
                                    </p>
                                    <p className="text-xs text-gray-400">{plan.durationDays} ngày</p>
                                </div>
                                <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${plan.isActive ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' : 'bg-gray-100 text-gray-500'}`}>
                                    {plan.isActive ? 'Hoạt động' : 'Tắt'}
                                </span>
                            </div>
                            <ul className="space-y-1 mb-4">
                                {[
                                    { key: 'noAds', label: 'Ẩn quảng cáo' },
                                    { key: 'offlineUnlimited', label: 'Nghe offline không giới hạn' },
                                    { key: 'premiumVoices', label: 'Giọng đọc cao cấp' },
                                ].map(({ key, label }) => (
                                    <li key={key} className={`flex items-center gap-2 text-xs ${b?.[key] ? 'text-gray-700 dark:text-gray-300' : 'text-gray-300 dark:text-zinc-600 line-through'}`}>
                                        {b?.[key]
                                            ? <Check className="h-3 w-3 text-green-500 shrink-0" />
                                            : <X className="h-3 w-3 text-gray-300 shrink-0" />}
                                        {label}
                                    </li>
                                ))}
                            </ul>
                            <div className="flex items-center gap-3">
                                <VipPlanEditButton plan={plan} />
                                <form action={handleDelete.bind(null, plan.id)}>
                                    <button
                                        type="submit"
                                        className="text-xs text-red-500 hover:text-red-700 font-medium"
                                        onClick={(e) => { if (!confirm('Xoá gói này?')) e.preventDefault(); }}
                                    >
                                        Xoá
                                    </button>
                                </form>
                            </div>
                        </div>
                    );
                })}

                {/* Create card */}
                <CreateVipPlanButton />
            </div>
        </div>
    );
}
