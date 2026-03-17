'use client'

import { createStory } from "@/actions/admin";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Image as ImageIcon, Loader2 } from "lucide-react";
import { GENRES } from "@/lib/constants";

export default function CreateStoryPage() {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [coverUrl, setCoverUrl] = useState("");
    const [error, setError] = useState("");

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
        setError("");

        if (coverUrl) {
            formData.set('coverImage', coverUrl);
        }

        const res = await createStory(formData);
        if (res?.error) {
            setError(res.error);
            setIsSubmitting(false);
        } else if (res?.success && res?.id) {
            router.push(`/admin/stories/${res.id}`);
        } else {
            // Fallback
            router.push('/admin/stories');
        }
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Thêm Truyện Mới</h1>
                <Link
                    href="/admin/stories"
                    className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                >
                    Hủy bỏ
                </Link>
            </div>

            <form action={handleSubmit} className="space-y-6 bg-white p-6 rounded-xl border border-gray-200 shadow-sm dark:bg-zinc-800 dark:border-zinc-700">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tên Truyện</label>
                        <input
                            name="title"
                            required
                            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary dark:bg-zinc-700 dark:border-zinc-600 dark:text-white"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tác Giả</label>
                        <input
                            name="author"
                            required
                            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary dark:bg-zinc-700 dark:border-zinc-600 dark:text-white"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Trạng Thái</label>
                        <select
                            name="status"
                            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary dark:bg-zinc-700 dark:border-zinc-600 dark:text-white"
                        >
                            <option value="ONGOING">Đang Ra</option>
                            <option value="COMPLETED">Hoàn Thành</option>
                            <option value="TRANSLATED">Dịch</option>
                            <option value="CONVERTED">Convert</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Lượt Xem (Seeding)</label>
                        <input
                            type="number"
                            name="viewCount"
                            defaultValue={0}
                            min={0}
                            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary dark:bg-zinc-700 dark:border-zinc-600 dark:text-white"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Điểm Đánh Giá (0-10)</label>
                        <input
                            type="number"
                            name="ratingScore"
                            defaultValue={5.0} // Default reasonable
                            min={0}
                            max={10}
                            step="0.1"
                            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary dark:bg-zinc-700 dark:border-zinc-600 dark:text-white"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Số Lượng Đánh Giá (Seeding)</label>
                        <input
                            type="number"
                            name="ratingCount"
                            defaultValue={0}
                            min={0}
                            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary dark:bg-zinc-700 dark:border-zinc-600 dark:text-white"
                        />
                    </div>

                    <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Ảnh Bìa</label>
                        <div className="mt-2 flex items-center gap-4">
                            {coverUrl ? (
                                <img src={coverUrl} alt="Cover" className="h-32 w-24 object-cover rounded-md border border-gray-200" />
                            ) : (
                                <div className="flex h-32 w-24 items-center justify-center rounded-md border-2 border-dashed border-gray-300 bg-gray-50 dark:bg-zinc-700/50 dark:border-zinc-600">
                                    <ImageIcon className="h-8 w-8 text-gray-400" />
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
                    </div>

                    <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Giới Thiệu</label>
                        <textarea
                            name="description"
                            rows={4}
                            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary dark:bg-zinc-700 dark:border-zinc-600 dark:text-white"
                        />
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
                        <div className="col-span-2" key={label}>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{label}</label>
                            <div className="grid grid-cols-3 gap-3 md:grid-cols-5">
                                {tags.map(tag => (
                                    <label key={tag} className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-700/50 p-1.5 rounded-lg transition-colors border border-transparent hover:border-gray-200">
                                        <input
                                            type="checkbox"
                                            name="genres"
                                            value={tag}
                                            className="rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                                        />
                                        <span>{tag}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <div className="flex justify-end pt-4">
                    <button
                        type="submit"
                        disabled={isSubmitting || uploading}
                        className="flex items-center justify-center rounded-md bg-brand-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-orange-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Đang xử lý...
                            </>
                        ) : 'Tạo Truyện'}
                    </button>
                </div>
            </form>
        </div>
    );
}
