import { updateChapter } from "@/actions/admin";
import db from "@/lib/db";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

async function getChapter(id: string) {
    const chapter = await db.chapter.findUnique({ where: { id } });
    if (!chapter) notFound();

    // Fetch content từ R2
    let content = '';
    if (chapter.contentUrl) {
        try {
            const res = await fetch(chapter.contentUrl, { cache: 'no-store' });
            if (res.ok) content = await res.text();
        } catch {
            content = '';
        }
    }

    return { ...chapter, content };
}

export default async function EditChapterPage({ params }: { params: Promise<{ id: string; chapterId: string }> }) {
    const { id, chapterId } = await params;
    const chapter = await getChapter(chapterId);

    async function handleUpdate(formData: FormData) {
        "use server"
        await updateChapter(chapterId, formData);
        redirect(`/admin/stories/${id}`);
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Link href={`/admin/stories/${id}`} className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
                    <ArrowLeft className="h-6 w-6" />
                </Link>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Sửa Chương {chapter.index}</h1>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
                <form action={handleUpdate} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="md:col-span-1">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Số chương</label>
                            <input
                                name="index"
                                type="number"
                                defaultValue={chapter.index}
                                required
                                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-green-500 focus:outline-none dark:bg-zinc-900 dark:border-zinc-700"
                            />
                        </div>
                        <div className="md:col-span-3">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tên chương</label>
                            <input
                                name="title"
                                type="text"
                                defaultValue={chapter.title}
                                required
                                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-green-500 focus:outline-none dark:bg-zinc-900 dark:border-zinc-700"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nội dung</label>
                        <textarea
                            name="content"
                            defaultValue={chapter.content || ''}
                            required
                            rows={20}
                            className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-green-500 focus:outline-none dark:bg-zinc-900 dark:border-zinc-700 font-mono text-sm"
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <Link href={`/admin/stories/${id}`} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:border-zinc-600 dark:hover:bg-zinc-700">
                            Hủy
                        </Link>
                        <button type="submit" className="px-6 py-2 rounded-lg bg-green-600 text-white font-bold hover:bg-green-700">
                            Lưu Thay Đổi
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
