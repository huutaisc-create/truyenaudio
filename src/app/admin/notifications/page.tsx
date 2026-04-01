import { getPushNotifications } from "@/actions/admin";
import Link from "next/link";
import { Bell } from "lucide-react";
import CreateNotifButton from "./CreateNotifButton";

const STATUS_META: Record<string, { label: string; cls: string }> = {
    DRAFT:  { label: 'Nháp',  cls: 'bg-gray-100 text-gray-600 dark:bg-zinc-700 dark:text-zinc-300' },
    SENT:   { label: 'Đã gửi', cls: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' },
    FAILED: { label: 'Lỗi',   cls: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400' },
};

const TARGET_META: Record<string, string> = {
    ALL:              'Tất cả user',
    VIP:              'Chỉ VIP',
    USER_IDS:         'User cụ thể',
    STORY_FOLLOWERS:  'Người theo dõi truyện',
};

export default async function NotificationsPage({
    searchParams,
}: {
    searchParams: Promise<{ page?: string }>;
}) {
    const params = await searchParams;
    const page = Number(params.page) || 1;

    const { notifs, total, totalPages } = await getPushNotifications(page);

    return (
        <div className="space-y-5 max-w-3xl">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Push Notification <span className="text-base font-normal text-gray-400">({total})</span>
                </h1>
                <CreateNotifButton />
            </div>

            <div className="rounded-xl bg-white dark:bg-zinc-800 ring-1 ring-gray-900/5 dark:ring-white/10 divide-y divide-gray-100 dark:divide-zinc-700/50">
                {notifs.length === 0 && (
                    <div className="p-8 text-center">
                        <Bell className="h-10 w-10 text-gray-300 dark:text-zinc-600 mx-auto mb-2" />
                        <p className="text-gray-400 text-sm">Chưa có thông báo nào.</p>
                    </div>
                )}
                {notifs.map((n: any) => {
                    const statusMeta = STATUS_META[n.status] ?? STATUS_META.DRAFT;
                    return (
                        <div key={n.id} className="flex items-start gap-4 px-5 py-4">
                            <div className="rounded-lg bg-orange-100 dark:bg-orange-500/20 p-2 shrink-0 mt-0.5">
                                <Bell className="h-4 w-4 text-orange-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-medium text-gray-900 dark:text-white text-sm">{n.title}</p>
                                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusMeta.cls}`}>
                                        {statusMeta.label}
                                    </span>
                                </div>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{n.body}</p>
                                <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-400">
                                    <span>🎯 {TARGET_META[n.targetType] ?? n.targetType}</span>
                                    {n.status === 'SENT' && <span>📬 {n.sentCount.toLocaleString('vi-VN')} người</span>}
                                    <span>{new Date(n.createdAt).toLocaleString('vi-VN')}</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                    {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map(p => (
                        <Link
                            key={p}
                            href={`/admin/notifications?page=${p}`}
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
