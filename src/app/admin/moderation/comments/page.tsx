import { getComments, deleteComment } from "@/actions/admin";
import Link from "next/link";
import { Search, Trash2 } from "lucide-react";
import { redirect } from "next/navigation";

export default async function ModerationCommentsPage({
    searchParams,
}: {
    searchParams: Promise<{ query?: string; page?: string }>;
}) {
    const params = await searchParams;
    const query = params.query || "";
    const page = Number(params.page) || 1;

    const { comments, total, totalPages } = await getComments(query, page);

    async function handleDelete(id: string) {
        "use server"
        await deleteComment(id);
        redirect('/admin/moderation/comments');
    }

    return (
        <div className="space-y-5">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Bình luận <span className="text-base font-normal text-gray-400">({total})</span>
            </h1>

            <form className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                    name="query"
                    placeholder="Tìm nội dung hoặc tên user..."
                    defaultValue={query}
                    className="w-full rounded-lg border border-gray-300 pl-10 pr-4 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"
                />
            </form>

            <div className="rounded-xl bg-white dark:bg-zinc-800 ring-1 ring-gray-900/5 dark:ring-white/10 divide-y divide-gray-100 dark:divide-zinc-700/50">
                {comments.length === 0 && (
                    <p className="p-8 text-center text-gray-400 text-sm">Không có bình luận nào.</p>
                )}
                {comments.map((c: any) => (
                    <div key={c.id} className="flex items-start gap-4 px-5 py-4 hover:bg-gray-50 dark:hover:bg-zinc-700/30 transition-colors">
                        <div className="h-8 w-8 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5">
                            {c.user?.name?.charAt(0)?.toUpperCase() ?? '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2 flex-wrap">
                                <Link href={`/admin/users/${c.user?.id}`} className="text-sm font-medium text-gray-900 dark:text-white hover:underline">
                                    {c.user?.name ?? c.user?.email ?? '—'}
                                </Link>
                                <span className="text-xs text-gray-400">trong</span>
                                <span className="text-xs text-orange-500 truncate max-w-[200px]">{c.story?.title ?? '—'}</span>
                                <span className="text-[10px] text-gray-400">{new Date(c.createdAt).toLocaleString('vi-VN')}</span>
                            </div>
                            <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{c.content}</p>
                            {c.likeCount > 0 && (
                                <p className="text-xs text-gray-400 mt-0.5">👍 {c.likeCount}</p>
                            )}
                        </div>
                        <form action={handleDelete.bind(null, c.id)} className="shrink-0">
                            <button
                                type="submit"
                                onClick={(e) => { if (!confirm('Xoá bình luận này?')) e.preventDefault(); }}
                                className="text-red-400 hover:text-red-600 p-1 rounded transition-colors"
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </form>
                    </div>
                ))}
            </div>

            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                    {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map(p => (
                        <Link
                            key={p}
                            href={`/admin/moderation/comments?${new URLSearchParams({ ...(query && { query }), page: String(p) })}`}
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
