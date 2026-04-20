'use client';

import { Trash2 } from "lucide-react";

interface Props {
    storyId: string;
    storyTitle: string;
    onDelete: (id: string) => Promise<void>;
}

export default function DeleteStoryButton({ storyId, storyTitle, onDelete }: Props) {
    async function handleClick() {
        const confirmed = window.confirm(
            `Xóa truyện "${storyTitle}"?\n\nHành động này sẽ xóa toàn bộ chương, cover và không thể khôi phục.`
        );
        if (!confirmed) return;
        await onDelete(storyId);
    }

    return (
        <button
            type="button"
            onClick={handleClick}
            className="text-red-500 hover:text-red-700"
            title="Xóa truyện"
        >
            <Trash2 className="h-4 w-4" />
        </button>
    );
}
