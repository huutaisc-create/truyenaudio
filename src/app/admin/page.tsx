import { getDashboardStats } from "@/actions/admin";
import { BookOpen, Users, FileText, TrendingUp } from "lucide-react";

export default async function AdminDashboard() {
    const stats = await getDashboardStats();

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
                <p className="mt-2 text-gray-600 dark:text-gray-400">Tổng quan hệ thống</p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {/* Stories Card */}
                <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-900/5 dark:bg-zinc-800 dark:ring-white/10">
                    <div className="flex items-center gap-4">
                        <div className="rounded-lg bg-orange-100 p-3 text-orange-600 dark:bg-orange-500/20">
                            <BookOpen className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Tổng số Truyện</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.stories}</p>
                        </div>
                    </div>
                </div>

                {/* Chapters Card */}
                <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-900/5 dark:bg-zinc-800 dark:ring-white/10">
                    <div className="flex items-center gap-4">
                        <div className="rounded-lg bg-blue-100 p-3 text-blue-600 dark:bg-blue-500/20">
                            <FileText className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Tổng số Chương</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.chapters}</p>
                        </div>
                    </div>
                </div>

                {/* Users Card */}
                <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-900/5 dark:bg-zinc-800 dark:ring-white/10">
                    <div className="flex items-center gap-4">
                        <div className="rounded-lg bg-green-100 p-3 text-green-600 dark:bg-green-500/20">
                            <Users className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Thành viên</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.users}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
