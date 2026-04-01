'use client'

import { updateStory } from "@/actions/admin";
import { useState } from "react";
import { Image as ImageIcon } from "lucide-react";
import { useRouter } from "next/navigation";

const STORY_TAGS: Record<string, string[]> = {
    "Thể Loại": [
        "Tiên Hiệp", "Huyền Huyễn", "Khoa Huyễn", "Võ Hiệp", "Đô Thị", "Đồng Nhân",
        "Dã Sử", "Cạnh Kỹ", "Huyền Nghi", "Kiếm Hiệp", "Kỳ Ảo", "Linh Dị",
        "Mạt Thế", "Ngôn Tình", "Ngược", "Quân Sự", "Quan Trường", "Sắc",
        "Sủng", "Thám Hiểm", "Trinh Thám", "Trọng Sinh", "Võng Du", "Xuyên Không",
        "Xuyên Nhanh", "Phương Tây", "Việt Nam", "Light Novel", "Nữ Cường", "Đam Mỹ",
        "Bách Hợp", "Cung Đấu", "Gia Đấu", "Điền Văn", "Hài Hước", "Lịch Sử"
    ],
    "Bối Cảnh": ["Đông Phương", "Tây Phương", "Hiện Đại", "Cổ Đại", "Mạt Thế", "Tương Lai", "Dị Giới", "Huyền Ảo"],
    "Tính Cách": ["Điềm Đạm", "Nhiệt Huyết", "Vô Sỉ", "Thiết Huyết", "Nhẹ Nhàng", "Cơ Trí", "Lãnh Khốc", "Kiêu Ngạo", "Ngây Thơ"],
    "Lưu Phái": ["Hệ Thống", "Lão Gia", "Bàn Thờ", "Tùy Thân", "Nhạc Lý", "Ẩm Thực", "Vô Địch", "Xuyên Qua", "Trọng Sinh"],
    "Thị Giác": ["Nam Chủ", "Nữ Chủ", "Ngôi Thứ Nhất"],
};

const inputCls = "mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:bg-zinc-700 dark:border-zinc-600 dark:text-white focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500";

export default function EditStoryForm({ story }: { story: any }) {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [coverUrl, setCoverUrl] = useState(story.coverImage || "");
    const [storyType, setStoryType] = useState<string>(story.storyType || 'ORIGINAL');

    const isExternalType = storyType === 'CONVERT' || storyType === 'TRANSLATED';

    async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await fetch('/api/upload', { method: 'POST', body: formData });
            const data = await res.json();
            if (data.success) setCoverUrl(data.url);
            else alert(data.message || 'Upload failed');
        } catch (err) {
            console.error(err);
            alert('Upload error');
        } finally {
            setUploading(false);
        }
    }

    async function handleSubmit(formData: FormData) {
        setIsSubmitting(true);
        if (coverUrl) formData.set('coverImage', coverUrl);
        await updateStory(story.id, formData);
        setIsSubmitting(false);
        router.refresh();
        alert("Đã cập nhật thành công!");
    }

    return (
        <form action={handleSubmit} className="space-y-4" key={JSON.stringify(story)}>
            {/* Tên truyện */}
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tên Truyện</label>
                <input name="title" defaultValue={story.title} className={inputCls} required />
            </div>

            {/* Tác giả */}
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tác Giả</label>
                <input name="author" defaultValue={story.author} className={inputCls} required />
            </div>

            {/* Loại truyện + Trạng thái */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Loại Truyện</label>
                    <select
                        name="storyType"
                        value={storyType}
                        onChange={e => setStoryType(e.target.value)}
                        className={inputCls}
                    >
                        <option value="ORIGINAL">Sáng tác</option>
                        <option value="CONVERT">Convert</option>
                        <option value="TRANSLATED">Dịch</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Trạng Thái</label>
                    <select name="status" defaultValue={story.status} className={inputCls}>
                        <option value="ONGOING">Đang Ra</option>
                        <option value="COMPLETED">Hoàn Thành</option>
                    </select>
                </div>
            </div>

            {/* Convert / Dịch: thêm trường bổ sung */}
            {isExternalType && (
                <div className="rounded-lg border border-orange-200 dark:border-orange-500/30 bg-orange-50 dark:bg-orange-500/10 p-4 space-y-3">
                    <p className="text-xs font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wide">
                        Thông tin {storyType === 'CONVERT' ? 'Convert' : 'Dịch'}
                    </p>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            {storyType === 'CONVERT' ? 'Tên Converter' : 'Tên Dịch Giả'}
                        </label>
                        <input
                            name="translatorName"
                            defaultValue={story.translatorName || ''}
                            placeholder={storyType === 'CONVERT' ? 'Nhóm / cá nhân convert' : 'Nhóm / cá nhân dịch'}
                            className={inputCls}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Link Nguồn Gốc</label>
                        <input
                            name="sourceUrl"
                            type="url"
                            defaultValue={story.sourceUrl || ''}
                            placeholder="https://..."
                            className={inputCls}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            id="isCompleted"
                            type="checkbox"
                            name="isCompleted"
                            defaultChecked={story.isCompleted}
                            className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                        />
                        <label htmlFor="isCompleted" className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                            Đã hoàn thành {storyType === 'CONVERT' ? 'convert' : 'dịch'}
                        </label>
                    </div>
                </div>
            )}

            {/* Ẩn truyện */}
            <div className="flex items-center gap-2">
                <input
                    id="isHidden"
                    type="checkbox"
                    name="isHidden"
                    defaultChecked={story.isHidden}
                    className="rounded border-gray-300 text-red-500 focus:ring-red-500"
                />
                <label htmlFor="isHidden" className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                    Ẩn truyện khỏi public
                </label>
            </div>

            {/* Giới thiệu */}
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Giới Thiệu / Tóm Tắt</label>
                <textarea
                    name="description"
                    defaultValue={story.description}
                    className={`${inputCls} h-32`}
                />
            </div>

            {/* Ảnh bìa */}
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Ảnh Bìa</label>
                <div className="mt-2 flex items-center gap-4">
                    {coverUrl ? (
                        <img src={coverUrl} alt="Cover" className="h-20 w-16 object-cover rounded-md border border-gray-200" />
                    ) : (
                        <div className="flex h-20 w-16 items-center justify-center rounded-md border-2 border-dashed border-gray-300 bg-gray-50 dark:bg-zinc-700/50 dark:border-zinc-600">
                            <ImageIcon className="h-6 w-6 text-gray-400" />
                        </div>
                    )}
                    <div className="flex-1">
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleUpload}
                            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-600 hover:file:bg-orange-100 transition-all cursor-pointer"
                        />
                        {uploading && <p className="text-xs text-orange-500 mt-1">Đang tải ảnh lên...</p>}
                    </div>
                </div>
                <input type="hidden" name="coverImage" value={coverUrl} />
            </div>

            {/* Tags */}
            {Object.entries(STORY_TAGS).map(([label, tags]) => (
                <div key={label}>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{label}</label>
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                        {tags.map(tag => (
                            <label key={tag} className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-700/50 p-1 rounded transition-colors">
                                <input
                                    type="checkbox"
                                    name="genres"
                                    value={tag}
                                    defaultChecked={story.genres.some((g: any) => g.name === tag)}
                                    className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                                />
                                <span>{tag}</span>
                            </label>
                        ))}
                    </div>
                </div>
            ))}

            {/* Seeding */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Lượt Xem (Seeding)</label>
                    <input type="number" name="viewCount" defaultValue={story.viewCount || 0} className={inputCls} />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Điểm Đánh Giá (0-10)</label>
                    <input type="number" step="0.1" max="10" min="0" name="ratingScore" defaultValue={story.ratingScore || 0} className={inputCls} />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Số Lượng Đánh Giá (Seeding)</label>
                    <input type="number" name="ratingCount" defaultValue={story.ratingCount || 0} className={inputCls} />
                </div>
            </div>

            <div className="pt-2">
                <button
                    type="submit"
                    disabled={isSubmitting || uploading}
                    className="w-full rounded-md bg-orange-500 px-4 py-2 text-white hover:bg-orange-600 disabled:opacity-50"
                >
                    {isSubmitting ? 'Đang Lưu...' : 'Lưu Thay Đổi'}
                </button>
            </div>
        </form>
    );
}
