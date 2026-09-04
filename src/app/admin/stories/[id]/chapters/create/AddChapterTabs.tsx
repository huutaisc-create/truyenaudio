'use client'

import Link from "next/link";
import { useState } from "react";
import { FolderUp, Pencil } from "lucide-react";
import CreateChapterForm from "./CreateChapterForm";
import BulkChapterUpload from "./BulkChapterUpload";

export default function AddChapterTabs({ storyId, defaultIndex }: { storyId: string; defaultIndex: number }) {
    const [tab, setTab] = useState<'manual' | 'bulk'>('bulk');

    const tabBtn = (id: 'manual' | 'bulk', label: string, Icon: typeof Pencil) => (
        <button
            type="button"
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
                tab === id
                    ? 'border-brand-primary text-brand-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
        >
            <Icon className="h-4 w-4" /> {label}
        </button>
    );

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Thêm Chương</h1>
                <Link
                    href={`/admin/stories/${storyId}`}
                    className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                >
                    Hủy bỏ
                </Link>
            </div>

            <div className="flex gap-1 border-b border-gray-200 dark:border-zinc-700">
                {tabBtn('bulk', 'Từ thư mục (hàng loạt)', FolderUp)}
                {tabBtn('manual', 'Nhập tay 1 chương', Pencil)}
            </div>

            {tab === 'bulk'
                ? <BulkChapterUpload storyId={storyId} />
                : <CreateChapterForm storyId={storyId} defaultIndex={defaultIndex} embedded />}
        </div>
    );
}
