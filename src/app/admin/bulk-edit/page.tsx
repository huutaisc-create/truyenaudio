import { getStories } from "@/actions/admin";
import BulkEditClient from "./BulkEditClient";

export default async function BulkEditPage() {
    const { stories } = await getStories(undefined, 1);
    // Lấy thêm trang 2-5 để có đủ danh sách (tối đa 100 truyện)
    const pages = await Promise.all([2, 3, 4, 5].map(p => getStories(undefined, p)));
    const allStories = [
        ...stories,
        ...pages.flatMap(p => p.stories),
    ].map((s: any) => ({ id: s.id, title: s.title, slug: s.slug }));

    return (
        <div className="space-y-6 max-w-3xl">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Find & Replace</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Tìm và thay thế văn bản hàng loạt trong toàn bộ chương của một truyện.
                </p>
            </div>
            <BulkEditClient stories={allStories} />
        </div>
    );
}
