'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { EyeOff, Eye, Check } from 'lucide-react'
import { resolveReport, unhideReportedContent } from '@/actions/admin'

/**
 * Nút xử lý một báo cáo.
 *  - "Ẩn nội dung": đặt status = HIDDEN (KHÔNG xoá dữ liệu), đóng luôn mọi báo
 *    cáo đang chờ khác cùng trỏ vào nội dung đó.
 *  - "Bỏ qua": đóng báo cáo, giữ nguyên nội dung.
 *  - "Bỏ ẩn": khôi phục nội dung đã ẩn nhầm.
 */
export default function ReportActions({
    reportId, targetType, targetId, status, contentStatus, missing,
}: {
    reportId: string
    targetType: string
    targetId: string
    status: string
    contentStatus: string | null
    missing: boolean
}) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)

    async function run(fn: () => Promise<any>) {
        setLoading(true)
        await fn()
        setLoading(false)
        router.refresh()
    }

    const canHide = !missing && targetType !== 'USER' && contentStatus !== 'HIDDEN'
    const canUnhide = !missing && contentStatus === 'HIDDEN'
    const isPending = status === 'PENDING'

    return (
        <div className="flex flex-col gap-1.5 shrink-0 w-[132px]">
            {canHide && (
                <button
                    disabled={loading}
                    onClick={() => {
                        if (!confirm('Ẩn nội dung này khỏi app?\n\nDữ liệu không bị xoá, có thể bỏ ẩn lại sau.')) return
                        run(() => resolveReport(reportId, 'HIDE'))
                    }}
                    className="flex items-center justify-center gap-1.5 rounded-lg bg-rose-500 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-rose-600 disabled:opacity-40 transition-colors"
                >
                    <EyeOff className="h-3.5 w-3.5" /> Ẩn nội dung
                </button>
            )}

            {canUnhide && (
                <button
                    disabled={loading}
                    onClick={() => run(() => unhideReportedContent(targetType, targetId))}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 dark:border-zinc-600 px-2.5 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-700 disabled:opacity-40 transition-colors"
                >
                    <Eye className="h-3.5 w-3.5" /> Bỏ ẩn
                </button>
            )}

            {isPending && (
                <button
                    disabled={loading}
                    onClick={() => run(() => resolveReport(reportId, 'DISMISS'))}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 dark:border-zinc-600 px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-700 disabled:opacity-40 transition-colors"
                >
                    <Check className="h-3.5 w-3.5" /> Bỏ qua
                </button>
            )}
        </div>
    )
}
