import { getUserDetail } from "@/actions/admin";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Coins, BookOpen, Flame, Calendar, Shield } from "lucide-react";
import UserRoleForm from "./UserRoleForm";
import UserCreditForm from "./UserCreditForm";

const ROLE_META: Record<string, { label: string; cls: string }> = {
    USER:      { label: 'User',      cls: 'bg-gray-100 text-gray-600 dark:bg-zinc-700 dark:text-zinc-300' },
    ADMIN:     { label: 'Admin',     cls: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400' },
    EDITOR:    { label: 'Editor',    cls: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' },
    FINANCE:   { label: 'Finance',   cls: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' },
    MODERATOR: { label: 'Moderator', cls: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400' },
    SUPPORT:   { label: 'Support',   cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400' },
};

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const data = await getUserDetail(id);

    if (!data.user) notFound();

    const { user, creditTxs, history, reviews, comments } = data;
    const roleMeta = ROLE_META[user.role] ?? ROLE_META.USER;

    // VIP status
    const activeVip = user.userVips?.[0];
    const isVip = activeVip && new Date(activeVip.endAt) > new Date();

    return (
        <div className="space-y-6 max-w-5xl">
            {/* Back */}
            <Link href="/admin/users" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
                <ArrowLeft className="h-4 w-4" />
                Danh sách thành viên
            </Link>

            {/* Profile header */}
            <div className="rounded-xl bg-white dark:bg-zinc-800 ring-1 ring-gray-900/5 dark:ring-white/10 p-6">
                <div className="flex items-start gap-4">
                    {user.image ? (
                        <img src={user.image} alt="" className="h-16 w-16 rounded-full object-cover shrink-0" />
                    ) : (
                        <div className="h-16 w-16 rounded-full bg-orange-500 flex items-center justify-center text-white text-2xl font-bold shrink-0">
                            {user.name?.charAt(0)?.toUpperCase() ?? user.email?.charAt(0)?.toUpperCase() ?? '?'}
                        </div>
                    )}
                    <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <h1 className="text-xl font-bold text-gray-900 dark:text-white truncate">{user.name ?? 'Chưa đặt tên'}</h1>
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${roleMeta.cls}`}>
                                {roleMeta.label}
                            </span>
                            {isVip && (
                                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400">
                                    ⭐ VIP
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{user.email}</p>
                        <p className="text-xs text-gray-400 mt-1">ID: {user.id}</p>
                    </div>
                </div>

                {/* Stats row */}
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-lg bg-gray-50 dark:bg-zinc-700/50 p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                            <Coins className="h-3.5 w-3.5 text-orange-500" />
                            <span className="text-xs text-gray-500 dark:text-gray-400">Credits</span>
                        </div>
                        <p className="text-xl font-bold text-gray-900 dark:text-white">{user.downloadCredits.toFixed(1)}</p>
                    </div>
                    <div className="rounded-lg bg-gray-50 dark:bg-zinc-700/50 p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                            <BookOpen className="h-3.5 w-3.5 text-blue-500" />
                            <span className="text-xs text-gray-500 dark:text-gray-400">Chương đọc</span>
                        </div>
                        <p className="text-xl font-bold text-gray-900 dark:text-white">{user.chaptersRead.toLocaleString('vi-VN')}</p>
                    </div>
                    <div className="rounded-lg bg-gray-50 dark:bg-zinc-700/50 p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                            <Flame className="h-3.5 w-3.5 text-red-500" />
                            <span className="text-xs text-gray-500 dark:text-gray-400">Streak</span>
                        </div>
                        <p className="text-xl font-bold text-gray-900 dark:text-white">{user.currentStreak} ngày</p>
                    </div>
                    <div className="rounded-lg bg-gray-50 dark:bg-zinc-700/50 p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                            <Calendar className="h-3.5 w-3.5 text-purple-500" />
                            <span className="text-xs text-gray-500 dark:text-gray-400">Tham gia</span>
                        </div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            {new Date(user.createdAt).toLocaleDateString('vi-VN')}
                        </p>
                    </div>
                </div>
            </div>

            {/* Admin actions */}
            <div className="grid gap-4 sm:grid-cols-2">
                {/* Đổi role */}
                <div className="rounded-xl bg-white dark:bg-zinc-800 ring-1 ring-gray-900/5 dark:ring-white/10 p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <Shield className="h-4 w-4 text-indigo-500" />
                        <h2 className="font-semibold text-gray-900 dark:text-white text-sm">Đổi Role</h2>
                    </div>
                    <UserRoleForm userId={user.id} currentRole={user.role} />
                </div>

                {/* Điều chỉnh credit */}
                <div className="rounded-xl bg-white dark:bg-zinc-800 ring-1 ring-gray-900/5 dark:ring-white/10 p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <Coins className="h-4 w-4 text-orange-500" />
                        <h2 className="font-semibold text-gray-900 dark:text-white text-sm">Điều Chỉnh Credit</h2>
                    </div>
                    <UserCreditForm userId={user.id} currentBalance={user.downloadCredits} />
                </div>
            </div>

            {/* Credit transactions */}
            <div className="rounded-xl bg-white dark:bg-zinc-800 ring-1 ring-gray-900/5 dark:ring-white/10 p-5">
                <h2 className="font-semibold text-gray-900 dark:text-white text-sm mb-4">
                    Lịch sử giao dịch credit <span className="text-gray-400 font-normal">({creditTxs.length})</span>
                </h2>
                <div className="space-y-1 max-h-72 overflow-y-auto">
                    {creditTxs.length === 0 && (
                        <p className="text-sm text-gray-400 py-4 text-center">Chưa có giao dịch</p>
                    )}
                    {creditTxs.map((tx: any) => (
                        <div key={tx.id} className="flex items-center justify-between gap-2 py-2 border-b border-gray-50 dark:border-zinc-700/50 last:border-0">
                            <div className="min-w-0 flex-1">
                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{tx.note ?? tx.type}</p>
                                <p className="text-[10px] text-gray-400">
                                    {new Date(tx.createdAt).toLocaleString('vi-VN')} · sau: {tx.balanceAfter.toFixed(1)}
                                </p>
                            </div>
                            <span className={`text-sm font-bold shrink-0 ${tx.amount > 0 ? 'text-green-500' : 'text-red-400'}`}>
                                {tx.amount > 0 ? '+' : ''}{tx.amount.toFixed(1)}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Reading history */}
            <div className="rounded-xl bg-white dark:bg-zinc-800 ring-1 ring-gray-900/5 dark:ring-white/10 p-5">
                <h2 className="font-semibold text-gray-900 dark:text-white text-sm mb-4">
                    Lịch sử đọc gần đây <span className="text-gray-400 font-normal">({history.length})</span>
                </h2>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                    {history.length === 0 && (
                        <p className="text-sm text-gray-400 py-4 text-center">Chưa có lịch sử</p>
                    )}
                    {history.map((h: any) => (
                        <div key={h.id} className="flex items-center gap-3 py-1.5 border-b border-gray-50 dark:border-zinc-700/50 last:border-0">
                            {h.story?.coverImage && (
                                <img src={h.story.coverImage} alt="" className="w-7 h-9 object-cover rounded shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm text-gray-900 dark:text-white truncate">{h.story?.title ?? '—'}</p>
                                <p className="text-[10px] text-gray-400">
                                    {new Date(h.visitedAt).toLocaleString('vi-VN')}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Reviews + Comments grid */}
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl bg-white dark:bg-zinc-800 ring-1 ring-gray-900/5 dark:ring-white/10 p-5">
                    <h2 className="font-semibold text-gray-900 dark:text-white text-sm mb-3">
                        Đánh giá <span className="text-gray-400 font-normal">({reviews.length})</span>
                    </h2>
                    <div className="space-y-2 max-h-52 overflow-y-auto">
                        {reviews.length === 0 && <p className="text-sm text-gray-400 py-3 text-center">Chưa có đánh giá</p>}
                        {reviews.map((r: any) => (
                            <div key={r.id} className="border-b border-gray-50 dark:border-zinc-700/50 last:border-0 pb-2">
                                <div className="flex items-center justify-between gap-2">
                                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{r.story?.title}</p>
                                    <span className="text-xs font-bold text-orange-500 shrink-0">{r.rating}/10</span>
                                </div>
                                <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">{r.content}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="rounded-xl bg-white dark:bg-zinc-800 ring-1 ring-gray-900/5 dark:ring-white/10 p-5">
                    <h2 className="font-semibold text-gray-900 dark:text-white text-sm mb-3">
                        Bình luận <span className="text-gray-400 font-normal">({comments.length})</span>
                    </h2>
                    <div className="space-y-2 max-h-52 overflow-y-auto">
                        {comments.length === 0 && <p className="text-sm text-gray-400 py-3 text-center">Chưa có bình luận</p>}
                        {comments.map((c: any) => (
                            <div key={c.id} className="border-b border-gray-50 dark:border-zinc-700/50 last:border-0 pb-2">
                                <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{c.story?.title}</p>
                                <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">{c.content}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
