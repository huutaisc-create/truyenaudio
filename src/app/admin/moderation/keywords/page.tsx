import { getSpamKeywords, deleteSpamKeyword } from "@/actions/admin";
import { redirect } from "next/navigation";
import AddKeywordForm from "./AddKeywordForm";
import { Trash2 } from "lucide-react";

export default async function KeywordsPage() {
    const keywords = await getSpamKeywords();

    async function handleDelete(id: string) {
        "use server"
        await deleteSpamKeyword(id);
        redirect('/admin/moderation/keywords');
    }

    return (
        <div className="space-y-6 max-w-2xl">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Từ khóa cấm</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Bình luận / đánh giá chứa từ khoá này sẽ bị từ chối tự động.
                </p>
            </div>

            {/* Add form */}
            <AddKeywordForm />

            {/* List */}
            <div className="rounded-xl bg-white dark:bg-zinc-800 ring-1 ring-gray-900/5 dark:ring-white/10">
                <div className="px-5 py-3 border-b border-gray-100 dark:border-zinc-700">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Danh sách <span className="text-gray-400">({keywords.length})</span>
                    </p>
                </div>
                {keywords.length === 0 && (
                    <p className="p-8 text-center text-gray-400 text-sm">Chưa có từ khoá nào.</p>
                )}
                <div className="divide-y divide-gray-100 dark:divide-zinc-700/50">
                    {keywords.map((kw: any) => (
                        <div key={kw.id} className="flex items-center gap-3 px-5 py-3">
                            <span className="flex-1 text-sm font-mono text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-zinc-700/50 rounded px-2 py-0.5">
                                {kw.keyword}
                            </span>
                            <span className="text-[11px] text-gray-400">
                                {new Date(kw.createdAt).toLocaleDateString('vi-VN')}
                            </span>
                            <form action={handleDelete.bind(null, kw.id)}>
                                <button
                                    type="submit"
                                    onClick={(e) => { if (!confirm('Xoá từ khoá này?')) e.preventDefault(); }}
                                    className="text-red-400 hover:text-red-600 p-1 rounded transition-colors"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            </form>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
