import { getChapters } from "@/actions/admin";
import db from "@/lib/db";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, ArrowLeft } from "lucide-react";
import EditStoryForm from "./EditStoryForm";
import ChapterListItem from "./ChapterListItem";

async function getStory(id: string) {
    const story = await db.story.findUnique({
        where: { id },
        include: { genres: true }
    });
    if (!story) notFound();
    return story;
}

export default async function StoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const story = await getStory(id);
    const chapters = await getChapters(id);

    return (
        <div className="space-y-8">
            <div className="flex items-center gap-4">
                <Link href="/admin/stories" className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
                    <ArrowLeft className="h-6 w-6" />
                </Link>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Chi tiết: {story.title}</h1>
            </div>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                {/* Left Column: Edit Story Form */}
                <div className="space-y-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">Cập Nhật Thông Tin</h2>
                    <EditStoryForm story={story} />
                </div>

                {/* Right Column: Chapter List */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Danh Sách Chương</h2>
                        <Link
                            href={`/admin/stories/${id}/chapters/create`}
                            className="flex items-center gap-2 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
                        >
                            <Plus className="h-4 w-4" /> Thêm Chương
                        </Link>
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-800 overflow-hidden max-h-[600px] overflow-y-auto">
                        {chapters.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">Chưa có chương nào.</div>
                        ) : (
                            <ul className="divide-y divide-gray-100 dark:divide-zinc-700">
                                {chapters.map(chapter => (
                                    <ChapterListItem key={chapter.id} chapter={chapter as any} />
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
