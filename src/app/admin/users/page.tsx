import { getUsers } from "@/actions/admin";
import Link from "next/link";
import { Search, Crown, Shield, Coins, Headphones, Eye } from "lucide-react";

const ROLE_META: Record<string, { label: string; cls: string }> = {
    USER:      { label: 'User',      cls: 'bg-gray-100 text-gray-600 dark:bg-zinc-700 dark:text-zinc-300' },
    ADMIN:     { label: 'Admin',     cls: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400' },
    EDITOR:    { label: 'Editor',    cls: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' },
    FINANCE:   { label: 'Finance',   cls: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' },
    MODERATOR: { label: 'Moderator', cls: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400' },
    SUPPORT:   { label: 'Support',   cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400' },
};

export default async function AdminUsersPage({
    searchParams,
}: {
    searchParams: Promise<{ query?: string; page?: string; role?: string }>;
}) {
    const params = await searchParams;
    const query = params.query || "";
    const page = Number(params.page) || 1;
    const role = params.role || "";

    const { users, total, totalPages } = await getUsers(query, page, role || undefined);

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Thành viên <span className="text-base font-normal text-gray-400">({total})</span>
                </h1>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
                {/* Search */}
                <form className="relative flex-1 min-w-[220px]">
                    {role && <input type="hidden" name="role" value={role} />}
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                        name="query"
                        placeholder="Tìm theo tên hoặc email..."
                        defaultValue={query}
                        className="w-full rounded-lg border border-gray-300 pl-10 pr-4 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"
                    />
                </form>

                {/* Role filter */}
                <div className="flex flex-wrap items-center gap-1.5">
                    {[
                        { value: '', label: 'Tất cả' },
                        { value: 'USER', label: 'User' },
                        { value: 'ADMIN', label: 'Admin' },
                        { value: 'EDITOR', label: 'Editor' },
                        { value: 'FINANCE', label: 'Finance' },
                        { value: 'MODERATOR', label: 'Moderator' },
                        { value: 'SUPPORT', label: 'Support' },
                    ].map(opt => (
                        <Link
                            key={opt.value}
                            href={`/admin/users?${new URLSearchParams({
                                ...(query && { query }),
                                ...(opt.value && { role: opt.value }),
                            })}`}
                            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                                role === opt.value
                                    ? 'bg-orange-500 text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600'
                            }`}
                        >
                            {opt.label}
                        </Link>
                    ))}
                </div>
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-700">
                    <thead className="bg-gray-50 dark:bg-zinc-700/50">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Thành viên</th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Role</th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                                <span className="flex items-center gap-1"><Coins className="h-3 w-3" /> Credits</span>
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 hidden md:table-cell">
                                <span className="flex items-center gap-1"><Headphones className="h-3 w-3" /> Chương đọc</span>
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 hidden lg:table-cell">Ngày tham gia</th>
                            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Chi tiết</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white dark:divide-zinc-700 dark:bg-zinc-800">
                        {users.map((user: any) => {
                            const roleMeta = ROLE_META[user.role] ?? ROLE_META.USER;
                            return (
                                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-zinc-700/30 transition-colors">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            {user.image ? (
                                                <img src={user.image} alt="" className="h-8 w-8 rounded-full object-cover shrink-0" />
                                            ) : (
                                                <div className="h-8 w-8 rounded-full bg-orange-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
                                                    {user.name?.charAt(0)?.toUpperCase() ?? user.email?.charAt(0)?.toUpperCase() ?? '?'}
                                                </div>
                                            )}
                                            <div className="min-w-0">
                                                <p className="font-medium text-gray-900 dark:text-white text-sm truncate max-w-[160px]">
                                                    {user.name ?? '—'}
                                                </p>
                                                <p className="text-[11px] text-gray-400 truncate max-w-[160px]">{user.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${roleMeta.cls}`}>
                                            {roleMeta.label}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hidden sm:table-cell">
                                        {user.downloadCredits.toFixed(1)}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hidden md:table-cell">
                                        {user.chaptersRead.toLocaleString('vi-VN')}
                                    </td>
                                    <td className="px-4 py-3 text-xs text-gray-400 hidden lg:table-cell whitespace-nowrap">
                                        {new Date(user.createdAt).toLocaleDateString('vi-VN')}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <Link
                                            href={`/admin/users/${user.id}`}
                                            className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium"
                                        >
                                            <Eye className="h-3.5 w-3.5" />
                                            Xem
                                        </Link>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {users.length === 0 && (
                    <div className="p-8 text-center text-gray-500 dark:text-gray-400">Không tìm thấy thành viên nào.</div>
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                    {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map(p => (
                        <Link
                            key={p}
                            href={`/admin/users?${new URLSearchParams({
                                ...(query && { query }),
                                ...(role && { role }),
                                page: String(p),
                            })}`}
                            className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                                p === page
                                    ? 'bg-orange-500 text-white'
                                    : 'bg-white dark:bg-zinc-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-zinc-700 hover:border-orange-300'
                            }`}
                        >
                            {p}
                        </Link>
                    ))}
                    {totalPages > 10 && <span className="text-gray-400 text-sm">... {totalPages}</span>}
                </div>
            )}
        </div>
    );
}
