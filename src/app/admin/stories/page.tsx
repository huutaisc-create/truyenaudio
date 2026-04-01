import { getStories, deleteStory } from "@/actions/admin";
import Link from "next/link";
import { Plus, Search, Edit, Trash2, EyeOff } from "lucide-react";
import { redirect } from 'next/navigation';

const STORY_TYPE_META: Record<string, { label: string; cls: string }> = {
    ORIGINAL:   { label: 'Sáng tác', cls: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400' },
    CONVERT:    { label: 'Convert',  cls: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' },
    TRANSLATED: { label: 'Dịch',     cls: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400' },
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
    ONGOING:   { label: 'Đang ra',    cls: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' },
    COMPLETED: { label: 'Hoàn thành', cls: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' },
};

export default async function AdminStoriesPage({
    searchParams,
}: {
    searchParams: Promise<{ query?: string; page?: string; type?: string; hidden?: string }>;
}) {
    const params = await searchParams;
    const query = params.query || "";
    const page = Number(params.page) || 1;
    const storyType = params.type || "";
    const showHidden = params.hidden === '1';

    const { stories, total, totalPages } = await getStories(query, page, storyType || undefined, showHidden || undefined);

    async function handleDelete(id: string) {
        "use server"
        await deleteStory(id);
        redirect('/admin/stories');
    }

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Quản lý Truyện <span className="text-base font-normal text-gray-400">({total})</span></h1>
                <Link
                    href="/admin/stories/create"
                    className="flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 transition-colors"
                >
                    <Plus className="h-4 w-4" />
                    Thêm Mới
                </Link>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
                {/* Search */}
                <form className="relative flex-1 min-w-[220px]">
                    {storyType && <input type="hidden" name="type" value={storyType} />}
                    {showHidden && <input type="hidden" name="hidden" value="1" />}
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                        name="query"
                        placeholder="Tìm tên truyện hoặc tác giả..."
                        defaultValue={query}
                        className="w-full rounded-lg border border-gray-300 pl-10 pr-4 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"
                    />
                </form>

                {/* Type filter */}
                <div className="flex items-center gap-1.5">
                    {[
                        { value: '', label: 'Tất cả' },
                        { value: 'ORIGINAL', label: 'Sáng tác' },
                        { value: 'CONVERT', label: 'Convert' },
                        { value: 'TRANSLATED', label: 'Dịch' },
                    ].map(opt => (
                        <Link
                            key={opt.value}
                            href={`/admin/stories?${new URLSearchParams({
                                ...(query && { query }),
                                ...(opt.value && { type: opt.value }),
                                ...(showHidden && { hidden: '1' }),
                            })}`}
                            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                                storyType === opt.value
                                    ? 'bg-orange-500 text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600'
                            }`}
                        >
                            {opt.label}
                        </Link>
                    ))}
                </div>

                {/* Show hidden toggle */}
                <Link
                    href={`/admin/stories?${new URLSearchParams({
                        ...(query && { query }),
                        ...(storyType && { type: storyType }),
                        ...(!showHidden && { hidden: '1' }),
                    })}`}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                        showHidden
                            ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600'
                    }`}
                >
                    <EyeOff className="h-3 w-3" />
                    {showHidden ? 'Đang xem: Ẩn' : 'Truyện bị ẩn'}
                </Link>
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-700">
                    <thead className="bg-gray-50 dark:bg-zinc-700/50">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Tên Truyện</th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 hidden sm:table-cell">Tác Giả</th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Loại</th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 hidden md:table-cell">Trạng Thái</th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 hidden md:table-cell">Chương</th>
                            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Hành Động</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white dark:divide-zinc-700 dark:bg-zinc-800">
                        {stories.map((story: any) => {
                            const typeMeta = STORY_TYPE_META[story.storyType] ?? STORY_TYPE_META.ORIGINAL;
                            const statusMeta = STATUS_META[story.status] ?? { label: story.status, cls: 'bg-gray-100 text-gray-600' };
                            return (
                                <tr key={story.id} className={story.isHidden ? 'opacity-60' : ''}>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            {story.coverImage ? (
                                                <img className="h-10 w-8 object-cover rounded shrink-0" src={story.coverImage} alt="" />
                                            ) : (
                                                <div className="h-10 w-8 rounded bg-gray-100 dark:bg-zinc-700 shrink-0" />
                                            )}
                                            <div className="min-w-0">
                                                <p className="font-medium text-gray-900 dark:text-white text-sm truncate max-w-[180px]">
                                                    {story.title}
                                                </p>
                                                {story.isHidden && (
                                                    <span className="inline-flex items-center gap-1 text-[10px] text-red-500">
                                                        <EyeOff className="h-3 w-3" /> Ẩn
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-300 hidden sm:table-cell whitespace-nowrap">
                                        {story.author}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${typeMeta.cls}`}>
                                            {typeMeta.label}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap hidden md:table-cell">
                                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusMeta.cls}`}>
                                            {statusMeta.label}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-300 hidden md:table-cell">
                                        {story._count.chapters}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <Link href={`/admin/stories/${story.id}`} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300">
                                                <Edit className="h-4 w-4" />
                                            </Link>
                                            <form action={handleDelete.bind(null, story.id)}>
                                                <button type="submit" className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300">
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </form>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {stories.length === 0 && (
                    <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                        {showHidden ? 'Không có truyện nào đang bị ẩn.' : 'Không tìm thấy truyện nào.'}
                    </div>
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                        <Link
                            key={p}
                            href={`/admin/stories?${new URLSearchParams({
                                ...(query && { query }),
                                ...(storyType && { type: storyType }),
                                ...(showHidden && { hidden: '1' }),
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
