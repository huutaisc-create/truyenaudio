'use client'

import { updateStory } from "@/actions/admin";
import { useState } from "react";
import { Image as ImageIcon, Loader2 } from "lucide-react";
import { GENRES } from "@/lib/constants";
import { useRouter } from "next/navigation";

export default function EditStoryForm({ story }: { story: any }) {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [coverUrl, setCoverUrl] = useState(story.coverImage || "");

    async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (data.success) {
                setCoverUrl(data.url);
            } else {
                alert(data.message || 'Upload failed');
            }
        } catch (err) {
            console.error(err);
            alert('Upload error');
        } finally {
            setUploading(false);
        }
    }

    async function handleSubmit(formData: FormData) {
        setIsSubmitting(true);
        if (coverUrl) {
            formData.set('coverImage', coverUrl);
        }
        await updateStory(story.id, formData);
        setIsSubmitting(false);
        router.refresh();
        alert("Đã cập nhật thành công!");
    }

    return (
        <form action={handleSubmit} className="space-y-4" key={JSON.stringify(story)}>
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tên Truyện</label>
                <input name="title" defaultValue={story.title} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:bg-zinc-700 dark:border-zinc-600 dark:text-white" required />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tác Giả</label>
                <input name="author" defaultValue={story.author} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:bg-zinc-700 dark:border-zinc-600 dark:text-white" required />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Giới Thiệu / Tóm Tắt</label>
                <textarea
                    name="description"
                    defaultValue={story.description}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:bg-zinc-700 dark:border-zinc-600 dark:text-white h-32"
                />
            </div>
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
                            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-brand-primary hover:file:bg-orange-100 transition-all cursor-pointer"
                        />
                        {uploading && <p className="text-xs text-brand-primary mt-1">Đang tải ảnh lên...</p>}
                    </div>
                </div>
                <input type="hidden" name="coverImage" value={coverUrl} />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Trạng Thái</label>
                <select name="status" defaultValue={story.status} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:bg-zinc-700 dark:border-zinc-600 dark:text-white">
                    <option value="ONGOING">Đang Ra</option>
                    <option value="COMPLETED">Hoàn Thành</option>
                    <option value="TRANSLATED">Dịch</option>
                    <option value="CONVERTED">Convert</option>
                </select>
            </div>
            {/* Dynamic Tag Sections */}
            {Object.entries({
                "Thể Loại": [
                    "Tiên Hiệp", "Huyền Huyễn", "Khoa Huyễn", "Võ Hiệp", "Đô Thị", "Đồng Nhân",
                    "Dã Sử", "Cạnh Kỹ", "Huyền Nghi", "Kiếm Hiệp", "Kỳ Ảo", "Linh Dị",
                    "Mạt Thế", "Ngôn Tình", "Ngược", "Quân Sự", "Quan Trường", "Sắc",
                    "Sủng", "Thám Hiểm", "Trinh Thám", "Trọng Sinh", "Võng Du", "Xuyên Không",
                    "Xuyên Nhanh", "Phương Tây", "Việt Nam", "Light Novel", "Nữ Cường", "Đam Mỹ",
                    "Bách Hợp", "Cung Đấu", "Gia Đấu", "Điền Văn", "Hài Hước", "Lịch Sử"
                ],
                "Bối Cảnh": [
                    "Đông Phương", "Tây Phương", "Hiện Đại", "Cổ Đại", "Mạt Thế", "Tương Lai", "Dị Giới", "Huyền Ảo"
                ],
                "Tính Cách": [
                    "Điềm Đạm", "Nhiệt Huyết", "Vô Sỉ", "Thiết Huyết", "Nhẹ Nhàng", "Cơ Trí", "Lãnh Khốc", "Kiêu Ngạo", "Ngây Thơ"
                ],
                "Lưu Phái": [
                    "Hệ Thống", "Lão Gia", "Bàn Thờ", "Tùy Thân", "Nhạc Lý", "Ẩm Thực", "Vô Địch", "Xuyên Qua", "Trọng Sinh"
                ],
                "Thị Giác": [
                    "Nam Chủ", "Nữ Chủ", "Ngôi Thứ Nhất"
                ]
            }).map(([label, tags]) => (
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
                                    className="rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                                />
                                <span>{tag}</span>
                            </label>
                        ))}
                    </div>
                </div>
            ))}

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Lượt Xem (Seeding)</label>
                    <input
                        type="number"
                        name="viewCount"
                        defaultValue={story.viewCount || 0}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:bg-zinc-700 dark:border-zinc-600 dark:text-white"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Điểm Đánh Giá (0-10)</label>
                    <input
                        type="number"
                        step="0.1"
                        max="10"
                        min="0"
                        name="ratingScore"
                        defaultValue={story.ratingScore || 0}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:bg-zinc-700 dark:border-zinc-600 dark:text-white"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Số Lượng Đánh Giá (Seeding)</label>
                    <input
                        type="number"
                        name="ratingCount"
                        defaultValue={story.ratingCount || 0}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:bg-zinc-700 dark:border-zinc-600 dark:text-white"
                    />
                </div>
            </div>

            <div className="pt-2">
                <button
                    type="submit"
                    disabled={isSubmitting || uploading}
                    className="w-full rounded-md bg-brand-primary px-4 py-2 text-white hover:bg-orange-600 disabled:opacity-50"
                >
                    {isSubmitting ? 'Đang Lưu...' : 'Lưu Thay Đổi'}
                </button>
            </div>
        </form>
    )
}
