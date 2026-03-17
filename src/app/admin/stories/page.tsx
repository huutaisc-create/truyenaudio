import { getStories, deleteStory } from "@/actions/admin";
import Link from "next/link";
import { Plus, Search, Edit, Trash2 } from "lucide-react";
import { redirect } from 'next/navigation';

export default async function AdminStoriesPage({
    searchParams,
}: {
    searchParams: Promise<{ query?: string; page?: string }>;
}) {
    const params = await searchParams; // Await searchParams as per Next.js 15+ 
    const query = params.query || "";
    const page = Number(params.page) || 1;

    const { stories, total, totalPages } = await getStories(query, page);

    async function handleDelete(id: string) {
        "use server"
        await deleteStory(id);
        redirect('/admin/stories');
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Quản lý Truyện ({total})</h1>
                <Link
                    href="/admin/stories/create"
                    className="flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 transition-colors"
                >
                    <Plus className="h-4 w-4" />
                    Thêm Mới
                </Link>
            </div>

            {/* Search Bar (Simple Form) */}
            <form className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                    name="query"
                    placeholder="Tìm tên truyện hoặc tác giả..."
                    defaultValue={query}
                    className="w-full rounded-lg border border-gray-300 pl-10 py-2 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"
                />
            </form>

            {/* Table */}
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow dark:border-zinc-700 dark:bg-zinc-800">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-700">
                    <thead className="bg-gray-50 dark:bg-zinc-700/50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Tên Truyện</th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Tác Giả</th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Trạng Thái</th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Chương</th>
                            <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Hành Động</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white dark:divide-zinc-700 dark:bg-zinc-800">
                        {stories.map((story: any) => (
                            <tr key={story.id}>
                                <td className="whitespace-nowrap px-6 py-4">
                                    <div className="flex items-center">
                                        {story.coverImage && (
                                            <img className="h-10 w-8 object-cover rounded mr-3" src={story.coverImage} alt="" />
                                        )}
                                        <span className="font-medium text-gray-900 dark:text-white">{story.title}</span>
                                    </div>
                                </td>
                                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-300">{story.author}</td>
                                <td className="whitespace-nowrap px-6 py-4">
                                    <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${story.status === 'ONGOING' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                            story.status === 'COMPLETED' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                                                'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                        }`}>
                                        {story.status}
                                    </span>
                                </td>
                                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-300">{story._count.chapters}</td>
                                <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
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
                        ))}
                    </tbody>
                </table>
                {stories.length === 0 && (
                    <div className="p-8 text-center text-gray-500 dark:text-gray-400">Không tìm thấy truyện nào.</div>
                )}
            </div>
        </div>
    );
}
