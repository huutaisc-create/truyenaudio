import { getCreditTransactions } from "@/actions/admin";
import Link from "next/link";
import { Search } from "lucide-react";

const TYPE_META: Record<string, { label: string; cls: string }> = {
    ADD_APP: { label: 'App',    cls: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' },
    ADD_WEB: { label: 'Web',    cls: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400' },
    SPEND:   { label: 'Spend',  cls: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400' },
};

export default async function TransactionsPage({
    searchParams,
}: {
    searchParams: Promise<{ query?: string; page?: string; type?: string }>;
}) {
    const params = await searchParams;
    const query = params.query || "";
    const page = Number(params.page) || 1;
    const type = params.type || "";

    const { txs, total, totalPages } = await getCreditTransactions(query, page, type || undefined);

    return (
        <div className="space-y-5">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Giao dịch Credit <span className="text-base font-normal text-gray-400">({total})</span>
            </h1>

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
                <form className="relative flex-1 min-w-[220px]">
                    {type && <input type="hidden" name="type" value={type} />}
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                        name="query"
                        placeholder="Tìm theo tên / email user..."
                        defaultValue={query}
                        className="w-full rounded-lg border border-gray-300 pl-10 pr-4 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"
                    />
                </form>
                <div className="flex items-center gap-1.5">
                    {[
                        { value: '', label: 'Tất cả' },
                        { value: 'ADD_APP', label: 'App' },
                        { value: 'ADD_WEB', label: 'Web' },
                        { value: 'SPEND', label: 'Spend' },
                    ].map(opt => (
                        <Link
                            key={opt.value}
                            href={`/admin/economy/transactions?${new URLSearchParams({
                                ...(query && { query }),
                                ...(opt.value && { type: opt.value }),
                            })}`}
                            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                                type === opt.value
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
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">User</th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Loại</th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Ghi chú</th>
                            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Số tiền</th>
                            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Sau GD</th>
                            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 hidden md:table-cell">Thời gian</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white dark:divide-zinc-700 dark:bg-zinc-800">
                        {txs.map((tx: any) => {
                            const meta = TYPE_META[tx.type] ?? { label: tx.type, cls: 'bg-gray-100 text-gray-600' };
                            return (
                                <tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-zinc-700/30 transition-colors">
                                    <td className="px-4 py-3">
                                        <Link href={`/admin/users/${tx.user.id}`} className="hover:underline">
                                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[140px]">
                                                {tx.user.name ?? '—'}
                                            </p>
                                            <p className="text-[11px] text-gray-400 truncate max-w-[140px]">{tx.user.email}</p>
                                        </Link>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${meta.cls}`}>
                                            {meta.label}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 max-w-[200px] truncate">
                                        {tx.note ?? '—'}
                                    </td>
                                    <td className={`px-4 py-3 text-right text-sm font-bold ${tx.amount > 0 ? 'text-green-500' : 'text-red-400'}`}>
                                        {tx.amount > 0 ? '+' : ''}{tx.amount.toFixed(1)}
                                    </td>
                                    <td className="px-4 py-3 text-right text-sm text-gray-600 dark:text-gray-300">
                                        {tx.balanceAfter.toFixed(1)}
                                    </td>
                                    <td className="px-4 py-3 text-right text-xs text-gray-400 hidden md:table-cell whitespace-nowrap">
                                        {new Date(tx.createdAt).toLocaleString('vi-VN')}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {txs.length === 0 && (
                    <div className="p-8 text-center text-gray-500 dark:text-gray-400">Không có giao dịch nào.</div>
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                    {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map(p => (
                        <Link
                            key={p}
                            href={`/admin/economy/transactions?${new URLSearchParams({
                                ...(query && { query }),
                                ...(type && { type }),
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
                </div>
            )}
        </div>
    );
}
