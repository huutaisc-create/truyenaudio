import { getReports } from "@/actions/admin";
import Link from "next/link";
import { Flag, EyeOff, Check, AlertCircle } from "lucide-react";
import ReportActions from "./ReportActions";

const STATUS_TABS = [
    { key: 'PENDING',   label: 'Chờ xử lý' },
    { key: 'ACTIONED',  label: 'Đã ẩn nội dung' },
    { key: 'DISMISSED', label: 'Đã bỏ qua' },
    { key: 'ALL',       label: 'Tất cả' },
];

const TARGET_LABEL: Record<string, string> = {
    COMMENT: 'Bình luận truyện',
    CHANNEL_POST: 'Bài đăng kênh',
    CHANNEL_POST_COMMENT: 'Bình luận kênh',
    USER: 'Người dùng',
};

export default async function ModerationReportsPage({
    searchParams,
}: {
    searchParams: Promise<{ status?: string; page?: string }>;
}) {
    const params = await searchParams;
    const status = params.status || 'PENDING';
    const page = Number(params.page) || 1;

    const { reports, total, totalPages, countMap } = await getReports(status, page);

    return (
        <div className="space-y-5">
            <div className="flex items-center gap-3">
                <Flag className="h-6 w-6 text-rose-500" />
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Báo cáo từ người dùng{" "}
                    <span className="text-base font-normal text-gray-400">({total})</span>
                </h1>
            </div>

            {/* Tabs trạng thái */}
            <div className="flex flex-wrap gap-2">
                {STATUS_TABS.map(t => {
                    const n = t.key === 'ALL'
                        ? Object.values(countMap).reduce((a, b) => a + b, 0)
                        : (countMap[t.key] ?? 0);
                    const active = status === t.key;
                    return (
                        <Link
                            key={t.key}
                            href={`/admin/moderation/reports?status=${t.key}`}
                            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                                active
                                    ? 'bg-rose-500 text-white'
                                    : 'bg-white dark:bg-zinc-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-zinc-700 hover:border-rose-300'
                            }`}
                        >
                            {t.label}
                            <span className={`ml-1.5 text-xs ${active ? 'text-rose-100' : 'text-gray-400'}`}>
                                {n}
                            </span>
                        </Link>
                    );
                })}
            </div>

            <div className="rounded-xl bg-white dark:bg-zinc-800 ring-1 ring-gray-900/5 dark:ring-white/10 divide-y divide-gray-100 dark:divide-zinc-700/50">
                {reports.length === 0 && (
                    <p className="p-8 text-center text-gray-400 text-sm">
                        {status === 'PENDING' ? 'Không có báo cáo nào đang chờ. 🎉' : 'Không có báo cáo nào.'}
                    </p>
                )}

                {reports.map((r: any) => (
                    <div key={r.id} className="px-5 py-4 hover:bg-gray-50 dark:hover:bg-zinc-700/30 transition-colors">
                        <div className="flex items-start gap-4">
                            <div className="flex-1 min-w-0 space-y-2">
                                {/* Dòng đầu: loại + lý do + thời gian */}
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="inline-flex rounded bg-gray-100 dark:bg-zinc-700 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:text-gray-300">
                                        {TARGET_LABEL[r.targetType] ?? r.targetType}
                                    </span>
                                    <span className="inline-flex rounded bg-rose-100 dark:bg-rose-900/40 px-2 py-0.5 text-[11px] font-semibold text-rose-700 dark:text-rose-300">
                                        {r.reasonLabel}
                                    </span>
                                    {r.target.contentStatus === 'HIDDEN' && (
                                        <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                                            <EyeOff className="h-3 w-3" /> Đang ẩn
                                        </span>
                                    )}
                                    {r.status === 'DISMISSED' && (
                                        <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
                                            <Check className="h-3 w-3" /> Đã bỏ qua
                                        </span>
                                    )}
                                    <span className="text-[11px] text-gray-400">
                                        {new Date(r.createdAt).toLocaleString('vi-VN')}
                                    </span>
                                </div>

                                {/* Nội dung bị báo cáo */}
                                {r.target.missing ? (
                                    <p className="flex items-center gap-1.5 text-sm text-gray-400 italic">
                                        <AlertCircle className="h-4 w-4" />
                                        Nội dung đã bị xoá khỏi hệ thống.
                                    </p>
                                ) : (
                                    <div className="rounded-lg bg-gray-50 dark:bg-zinc-900/50 px-3 py-2">
                                        <p className="text-[11px] text-gray-400 mb-0.5">
                                            {r.target.context} — của{" "}
                                            {r.target.authorId ? (
                                                <Link href={`/admin/users/${r.target.authorId}`} className="text-orange-500 hover:underline">
                                                    {r.target.authorName}
                                                </Link>
                                            ) : r.target.authorName}
                                        </p>
                                        <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words line-clamp-6">
                                            {r.target.content || <span className="italic text-gray-400">(trống)</span>}
                                        </p>
                                    </div>
                                )}

                                {/* Ghi chú người báo cáo */}
                                {r.note && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        <span className="font-medium">Ghi chú:</span> {r.note}
                                    </p>
                                )}

                                <p className="text-[11px] text-gray-400">
                                    Người báo cáo:{" "}
                                    <Link href={`/admin/users/${r.reporter?.id}`} className="hover:underline">
                                        {r.reporter?.name ?? r.reporter?.email ?? '—'}
                                    </Link>
                                </p>
                            </div>

                            <ReportActions
                                reportId={r.id}
                                targetType={r.targetType}
                                targetId={r.targetId}
                                status={r.status}
                                contentStatus={r.target.contentStatus}
                                missing={r.target.missing}
                            />
                        </div>
                    </div>
                ))}
            </div>

            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                    {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map(p => (
                        <Link
                            key={p}
                            href={`/admin/moderation/reports?status=${status}&page=${p}`}
                            className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                                p === page
                                    ? 'bg-rose-500 text-white'
                                    : 'bg-white dark:bg-zinc-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-zinc-700 hover:border-rose-300'
                            }`}
                        >
                            {p}
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
