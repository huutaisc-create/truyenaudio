"use client";

import { deleteChapter } from "@/actions/admin";
import { Trash2, Edit } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

type Chapter = {
    id: string;
    title: string;
    index: number;
    createdAt: Date;
    storyId: string;
    updatedAt: Date;
    content: string | null;
}

export default function ChapterListItem({ chapter }: { chapter: Chapter }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const handleDelete = async () => {
        const confirmed = window.confirm(`Bạn có chắc chắn muốn xóa "Chương ${chapter.index}: ${chapter.title}" không? Hành động này không thể hoàn tác.`);
        if (!confirmed) return;

        startTransition(async () => {
            const result = await deleteChapter(chapter.id, chapter.storyId);
            if (result.success) {
                // Refresh the page to show updated list
                router.refresh();
            } else {
                alert("Xóa thất bại: " + (result.error || "Lỗi không xác định"));
            }
        });
    };

    return (
        <li className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-zinc-700/50">
            <div>
                <p className="font-medium text-gray-900 dark:text-white">Chương {chapter.index}: {chapter.title}</p>
                <p className="text-xs text-gray-500">{new Date(chapter.createdAt).toLocaleDateString('vi-VN')}</p>
            </div>
            <div className="flex items-center gap-2">
                <Link
                    href={`/admin/stories/${chapter.storyId}/chapters/${chapter.id}/edit`}
                    className="p-2 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-full transition-colors"
                    title="Sửa chương"
                >
                    <Edit className="h-4 w-4" />
                </Link>
                <button
                    onClick={handleDelete}
                    disabled={isPending}
                    className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full transition-colors disabled:opacity-50"
                    title="Xóa chương"
                >
                    <Trash2 className="h-4 w-4" />
                </button>
            </div>
        </li>
    );
}
