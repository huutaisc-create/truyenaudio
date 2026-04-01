import { getStoryRequests, updateStoryRequest } from "@/actions/admin";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BookPlus } from "lucide-react";
import RequestStatusForm from "./RequestStatusForm";

const STATUS_META: Record<string, { label: string; cls: string }> = {
    PENDING:  { label: 'Chờ duyệt', cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400' },
    APPROVED: { label: 'Đã duyệt',  cls: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' },
    DONE:     { label: 'Đã đăng',   cls: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' },
    REJECTED: { label: 'Từ chối',   cls: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400' },
};

export default async function StoryRequestsPage({
    searchParams,
}: {
    searchParams: Promise<{ page?: string; status?: string }>;
}) {
    const params = await searchParams;
    const page = Number(params.page) || 1;
    const status = params.status || "";

    const { requests, total, totalPages } = await getStoryRequests(page, status || undefined);

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <BookPlus className="h-6 w-6 text-orange-500" />
                    Yêu cầu truyện
                    <span className="text-base font-normal text-gray-400">({total})</span>
                </h1>
            </div>

            {/* Status filter */}
            <div className="flex flex-wrap gap-2">
                {[
                    { value: '', label: 'Tất cả' },
                    { value: 'PENDING', label: 'Chờ duyệt' },
                    { value: 'APPROVED', label: 'Đã duyệt' },
                    { value: 'DONE', label: 'Đã đăng' },
                    { value: 'REJECTED', label: 'Từ chối' },
                ].map(opt => (
                    <Link
                        key={opt.value}
                        href={`/admin/requests?${new URLSearchParams({ ...(opt.value && { status: opt.value }) })}`}
                        className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                            status === opt.value
                                ? 'bg-orange-500 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600'
                        }`}
                    >
                        {opt.label}
                    </Link>
                ))}
            </div>

            {/* List */}
            <div className="rounded-xl bg-white dark:bg-zinc-800 ring-1 ring-gray-900/5 dark:ring-white/10 divide-y divide-gray-100 dark:divide-zinc-700/50">
                {requests.length === 0 && (
                    <p className="p-8 text-center text-gray-400 text-sm">Không có yêu cầu nào.</p>
                )}
                {requests.map((req: any) => {
                    const meta = STATUS_META[req.status] ?? STATUS_META.PENDING;
                    return (
                        <div key={req.id} className="flex items-start gap-4 px-5 py-4">
                            <div className="flex-1 min-w-0 space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-semibold text-gray-900 dark:text-white text-sm">
                                        {req.title}
                                    </p>
                                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${meta.cls}`}>
                                        {meta.label}
                                    </span>
                                    {req.story && (
                                        <Link
                                            href={`/truyen/${req.story.slug}`}
                                            target="_blank"
                                            className="text-xs text-orange-500 hover:underline"
                                        >
                                            → {req.story.title}
                                        </Link>
                                    )}
                                </div>
                                {req.link && (
                                    <a href={req.link} target="_blank" rel="noopener noreferrer"
                                        className="text-xs text-blue-500 hover:underline truncate block max-w-md">
                                        {req.link}
                                    </a>
                                )}
                                {req.note && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{req.note}</p>
                                )}
                                <div className="flex items-center gap-3 text-[11px] text-gray-400">
                                    <Link href={`/admin/users/${req.user?.id}`} className="hover:underline hover:text-orange-500">
                                        {req.user?.name ?? req.user?.email ?? '—'}
                                    </Link>
                                    <span>{new Date(req.createdAt).toLocaleDateString('vi-VN')}</span>
                                </div>
                            </div>

                            {/* Actions */}
                            <RequestStatusForm requestId={req.id} currentStatus={req.status} />
                        </div>
                    );
                })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                    {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map(p => (
                        <Link
                            key={p}
                            href={`/admin/requests?${new URLSearchParams({ ...(status && { status }), page: String(p) })}`}
                            className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                                p === page
                                    ? 'bg-orange-500 text-white'
                                    : 'bg-white dark:bg-zinc-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-zinc-700 hover:border-orange-300'
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
