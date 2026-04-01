import { getAdminLogs } from "@/actions/admin";
import { requireAdmin } from "@/lib/admin-guard";
import Link from "next/link";

const ACTION_COLORS: Record<string, string> = {
    DELETE_STORY:   'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
    DELETE_COMMENT: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400',
    DELETE_REVIEW:  'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400',
    ADJUST_CREDIT:  'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400',
    CHANGE_ROLE:    'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400',
    CREATE_STORY:   'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
};

export default async function AdminLogsPage({
    searchParams,
}: {
    searchParams: Promise<{ page?: string; action?: string }>;
}) {
    // Only ADMIN role
    await requireAdmin(['ADMIN']);

    const params = await searchParams;
    const page = Number(params.page) || 1;
    const action = params.action || "";

    const { logs, total, totalPages } = await getAdminLogs(page, action || undefined);

    const uniqueActions = ['DELETE_STORY', 'DELETE_COMMENT', 'DELETE_REVIEW', 'ADJUST_CREDIT', 'CHANGE_ROLE', 'CREATE_STORY'];

    return (
        <div className="space-y-5">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Nhật ký Admin <span className="text-base font-normal text-gray-400">({total})</span>
            </h1>

            {/* Filter by action */}
            <div className="flex flex-wrap gap-1.5">
                {[{ value: '', label: 'Tất cả' }, ...uniqueActions.map(a => ({ value: a, label: a }))].map(opt => (
                    <Link
                        key={opt.value}
                        href={`/admin/logs?${new URLSearchParams({ ...(opt.value && { action: opt.value }) })}`}
                        className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                            action === opt.value
                                ? 'bg-orange-500 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600'
                        }`}
                    >
                        {opt.label}
                    </Link>
                ))}
            </div>

            <div className="rounded-xl bg-white dark:bg-zinc-800 ring-1 ring-gray-900/5 dark:ring-white/10 divide-y divide-gray-100 dark:divide-zinc-700/50">
                {logs.length === 0 && (
                    <p className="p-8 text-center text-gray-400 text-sm">Chưa có nhật ký nào.</p>
                )}
                {logs.map((log: any) => (
                    <div key={log.id} className="flex items-start gap-4 px-5 py-4">
                        <div className="h-8 w-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5">
                            {log.admin?.name?.charAt(0)?.toUpperCase() ?? 'A'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium text-gray-900 dark:text-white">
                                    {log.admin?.name ?? log.admin?.email ?? '—'}
                                </span>
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${ACTION_COLORS[log.action] ?? 'bg-gray-100 text-gray-600'}`}>
                                    {log.action}
                                </span>
                                {log.targetType && (
                                    <span className="text-xs text-gray-400">{log.targetType}</span>
                                )}
                            </div>
                            {log.detail && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate max-w-lg">{log.detail}</p>
                            )}
                            <p className="text-[10px] text-gray-400 mt-0.5">{new Date(log.createdAt).toLocaleString('vi-VN')}</p>
                        </div>
                    </div>
                ))}
            </div>

            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                    {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map(p => (
                        <Link
                            key={p}
                            href={`/admin/logs?${new URLSearchParams({ ...(action && { action }), page: String(p) })}`}
                            className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${p === page ? 'bg-orange-500 text-white' : 'bg-white dark:bg-zinc-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-zinc-700 hover:border-orange-300'}`}
                        >
                            {p}
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
