'use client'
import { useState } from "react";
import VipPlanForm from "./VipPlanForm";

export default function VipPlanEditButton({ plan }: { plan: any }) {
    const [open, setOpen] = useState(false);
    return (
        <>
            <button onClick={() => setOpen(true)} className="text-xs text-indigo-500 hover:text-indigo-700 font-medium">
                Sửa
            </button>
            {open && <VipPlanForm plan={plan} onClose={() => setOpen(false)} />}
        </>
    );
}
