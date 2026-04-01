'use client'
import { useState } from "react";
import VipPlanForm from "./VipPlanForm";
import { Plus } from "lucide-react";

export default function CreateVipPlanButton() {
    const [open, setOpen] = useState(false);
    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="rounded-xl border-2 border-dashed border-gray-300 dark:border-zinc-600 flex flex-col items-center justify-center gap-2 p-5 text-gray-400 hover:border-orange-400 hover:text-orange-500 transition-colors min-h-[200px]"
            >
                <Plus className="h-6 w-6" />
                <span className="text-sm font-medium">Thêm gói mới</span>
            </button>
            {open && <VipPlanForm onClose={() => setOpen(false)} />}
        </>
    );
}
