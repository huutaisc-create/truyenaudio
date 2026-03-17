import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, BookOpen, Users, Settings, LogOut } from "lucide-react";

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await auth();

    if (!session?.user) {
        redirect("/login");
    }

    // Strict role check can be enabled here
    // if (session.user.role !== "ADMIN") {
    //   redirect("/");
    // }

    return (
        <div className="flex min-h-screen bg-gray-100 dark:bg-zinc-900">
            {/* Sidebar */}
            <aside className="fixed inset-y-0 left-0 w-64 bg-white shadow-lg dark:bg-zinc-800 z-40 hidden md:block">
                <div className="flex h-16 items-center justify-center border-b px-6 dark:border-zinc-700">
                    <span className="text-xl font-bold text-brand-primary">Admin Panel</span>
                </div>
                <nav className="p-4 space-y-2">
                    <Link
                        href="/admin"
                        className="flex items-center gap-3 rounded-lg px-4 py-3 text-gray-700 transition-colors hover:bg-orange-50 hover:text-brand-primary dark:text-zinc-300 dark:hover:bg-zinc-700"
                    >
                        <LayoutDashboard className="h-5 w-5" />
                        <span className="font-medium">Dashboard</span>
                    </Link>
                    <Link
                        href="/admin/stories"
                        className="flex items-center gap-3 rounded-lg px-4 py-3 text-gray-700 transition-colors hover:bg-orange-50 hover:text-brand-primary dark:text-zinc-300 dark:hover:bg-zinc-700"
                    >
                        <BookOpen className="h-5 w-5" />
                        <span className="font-medium">Quản lý Truyện</span>
                    </Link>
                    <Link
                        href="/admin/users"
                        className="flex items-center gap-3 rounded-lg px-4 py-3 text-gray-700 transition-colors hover:bg-orange-50 hover:text-brand-primary dark:text-zinc-300 dark:hover:bg-zinc-700"
                    >
                        <Users className="h-5 w-5" />
                        <span className="font-medium">Thành viên</span>
                    </Link>
                </nav>
                <div className="absolute bottom-4 left-4 right-4">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-zinc-700/50">
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold truncate dark:text-zinc-200">{session.user.name}</p>
                            <p className="text-xs text-gray-500 dark:text-zinc-400 capitalize">{session.user.role || 'User'}</p>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-8 md:ml-64">
                {children}
            </main>
        </div>
    );
}
