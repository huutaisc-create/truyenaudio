import { getDashboardStats } from '@/actions/admin';
import {
  BookOpen, Users, FileText, TrendingUp,
  UserPlus, Activity, ArrowUpCircle, ArrowDownCircle,
} from 'lucide-react';

export default async function AdminDashboard() {
  const stats = await getDashboardStats();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Tổng quan hệ thống hôm nay</p>
      </div>

      {/* Hàng 1 — 5 cards tổng quan */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard icon={<BookOpen className="h-5 w-5" />}  color="orange" label="Tổng truyện"          value={stats.stories.toLocaleString('vi-VN')} />
        <StatCard icon={<FileText className="h-5 w-5" />}  color="blue"   label="Tổng chương"           value={stats.chapters.toLocaleString('vi-VN')} />
        <StatCard icon={<Users className="h-5 w-5" />}     color="purple" label="Tổng thành viên"       value={stats.users.toLocaleString('vi-VN')} />
        <StatCard icon={<UserPlus className="h-5 w-5" />}  color="green"  label="Thành viên mới hôm nay" value={stats.newUsersToday.toLocaleString('vi-VN')} />
        <StatCard icon={<Activity className="h-5 w-5" />}  color="cyan"   label="User active hôm nay"   value={stats.activeUsersToday.toLocaleString('vi-VN')} />
      </div>

      {/* Hàng 2 — Credit flow hôm nay */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl bg-white dark:bg-zinc-800 p-5 ring-1 ring-gray-900/5 dark:ring-white/10">
          <div className="flex items-center gap-3 mb-3">
            <div className="rounded-lg bg-green-100 dark:bg-green-500/20 p-2">
              <ArrowUpCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Credit phát ra hôm nay</p>
          </div>
          <p className="text-3xl font-black text-green-600 dark:text-green-400">
            +{stats.creditIssued.toLocaleString('vi-VN')}
          </p>
          <p className="text-xs text-gray-400 mt-1">Tổng lượng credit thưởng cho user</p>
        </div>

        <div className="rounded-xl bg-white dark:bg-zinc-800 p-5 ring-1 ring-gray-900/5 dark:ring-white/10">
          <div className="flex items-center gap-3 mb-3">
            <div className="rounded-lg bg-red-100 dark:bg-red-500/20 p-2">
              <ArrowDownCircle className="h-5 w-5 text-red-500 dark:text-red-400" />
            </div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Credit tiêu thụ hôm nay</p>
          </div>
          <p className="text-3xl font-black text-red-500 dark:text-red-400">
            -{stats.creditConsumed.toLocaleString('vi-VN')}
          </p>
          <p className="text-xs text-gray-400 mt-1">Tổng lượng credit user đã dùng</p>
        </div>
      </div>

      {/* Hàng 3 — Top stories + Recent transactions */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* Top 5 truyện hot 7 ngày */}
        <div className="rounded-xl bg-white dark:bg-zinc-800 p-5 ring-1 ring-gray-900/5 dark:ring-white/10">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-orange-500" />
            <h2 className="font-semibold text-gray-900 dark:text-white text-sm">Top truyện được nghe (7 ngày)</h2>
          </div>
          <div className="space-y-3">
            {stats.topStories.length === 0 && (
              <p className="text-sm text-gray-400 py-4 text-center">Chưa có dữ liệu</p>
            )}
            {stats.topStories.map((item: any, idx: number) => (
              <div key={item.storyId} className="flex items-center gap-3">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  idx === 0 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                  idx === 1 ? 'bg-gray-100 text-gray-600 dark:bg-zinc-700 dark:text-gray-300' :
                  idx === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                              'bg-gray-50 text-gray-400 dark:bg-zinc-700 dark:text-zinc-400'
                }`}>
                  {idx + 1}
                </span>
                {item.story?.coverImage && (
                  <img src={item.story.coverImage} alt="" className="w-8 h-10 object-cover rounded shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {item.story?.title ?? '—'}
                  </p>
                </div>
                <span className="text-xs font-semibold text-orange-500 shrink-0">
                  {item.count.toLocaleString('vi-VN')} lượt
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 10 giao dịch credit gần nhất */}
        <div className="rounded-xl bg-white dark:bg-zinc-800 p-5 ring-1 ring-gray-900/5 dark:ring-white/10">
          <h2 className="font-semibold text-gray-900 dark:text-white text-sm mb-4">Giao dịch credit gần nhất</h2>
          <div className="space-y-1">
            {stats.recentTransactions.length === 0 && (
              <p className="text-sm text-gray-400 py-4 text-center">Chưa có dữ liệu</p>
            )}
            {stats.recentTransactions.map((tx: any) => (
              <div key={tx.id} className="flex items-center justify-between gap-2 py-2 border-b border-gray-50 dark:border-zinc-700/50 last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-gray-900 dark:text-white truncate">
                    {tx.user?.name ?? tx.user?.email ?? '—'}
                  </p>
                  <p className="text-[10px] text-gray-400 truncate">{tx.note ?? tx.type}</p>
                </div>
                <span className={`text-xs font-bold shrink-0 ${tx.amount > 0 ? 'text-green-500' : 'text-red-400'}`}>
                  {tx.amount > 0 ? '+' : ''}{tx.amount.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Stat Card ──────────────────────────────────────────────────────
function StatCard({
  icon, color, label, value,
}: {
  icon: React.ReactNode;
  color: 'orange' | 'blue' | 'green' | 'purple' | 'cyan';
  label: string;
  value: string;
}) {
  const colors = {
    orange: 'bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400',
    blue:   'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400',
    green:  'bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400',
    purple: 'bg-purple-100 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400',
    cyan:   'bg-cyan-100 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400',
  };
  return (
    <div className="rounded-xl bg-white dark:bg-zinc-800 p-4 ring-1 ring-gray-900/5 dark:ring-white/10">
      <div className={`inline-flex rounded-lg p-2 mb-3 ${colors[color]}`}>{icon}</div>
      <p className="text-2xl font-black text-gray-900 dark:text-white">{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-tight">{label}</p>
    </div>
  );
}
