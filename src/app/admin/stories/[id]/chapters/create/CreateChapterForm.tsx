'use client'

import { createChapter } from "@/actions/admin";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";

export default function CreateChapterForm({ storyId, defaultIndex }: { storyId: string, defaultIndex: number }) {
    const router = useRouter();

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");

    async function handleSubmit(formData: FormData) {
        setIsSubmitting(true);
        setError("");

        const res = await createChapter(storyId, formData);

        if (res?.error) {
            setError(res.error);
            setIsSubmitting(false);
        } else {
            router.push(`/admin/stories/${storyId}`);
        }
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Thêm Chương Mới</h1>
                <Link
                    href={`/admin/stories/${storyId}`}
                    className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                >
                    Hủy bỏ
                </Link>
            </div>

            <form action={handleSubmit} className="space-y-6 bg-white p-6 rounded-xl border border-gray-200 shadow-sm dark:bg-zinc-800 dark:border-zinc-700">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
                    <div className="col-span-1">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Số Chương</label>
                        <input
                            name="index"
                            type="number"
                            required
                            defaultValue={defaultIndex}
                            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary dark:bg-zinc-700 dark:border-zinc-600 dark:text-white"
                        />
                    </div>
                    <div className="col-span-3">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tên Chương</label>
                        <input
                            name="title"
                            required
                            placeholder="Ví dụ: Mở đầu"
                            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary dark:bg-zinc-700 dark:border-zinc-600 dark:text-white"
                        />
                    </div>

                    <div className="col-span-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nội Dung</label>
                        <textarea
                            name="content"
                            required
                            rows={20}
                            placeholder="Nội dung chương..."
                            className="font-mono mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary dark:bg-zinc-700 dark:border-zinc-600 dark:text-white"
                        />
                    </div>
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <div className="flex justify-end pt-4">
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex items-center justify-center rounded-md bg-brand-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-orange-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Đang lưu...
                            </>
                        ) : 'Lưu Chương'}
                    </button>
                </div>
            </form>
        </div>
    );
}
