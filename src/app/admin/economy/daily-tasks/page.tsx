import { getDailyTasks } from "@/actions/admin";
import DailyTaskRow from "./DailyTaskRow";

const DEFAULT_TASKS = [
    { taskKey: 'CHECK_IN',   label: 'Điểm danh hàng ngày',          description: 'Check-in mỗi ngày để nhận credit', creditReward: 0.5,  isActive: true },
    { taskKey: 'LISTEN_10',  label: 'Nghe 10 phút',                  description: 'Nghe truyện tổng cộng 10 phút',    creditReward: 0.5,  isActive: true },
    { taskKey: 'WATCH_AD',   label: 'Xem video quảng cáo',           description: 'Xem 1 video rewarded',             creditReward: 1.0,  isActive: true },
    { taskKey: 'COMMENT',    label: 'Bình luận truyện',               description: 'Đăng bình luận hợp lệ',           creditReward: 0.5,  isActive: true },
    { taskKey: 'REVIEW',     label: 'Đánh giá truyện',               description: 'Gửi đánh giá mới',                creditReward: 1.0,  isActive: true },
    { taskKey: 'NOMINATE',   label: 'Đề cử truyện',                  description: 'Đề cử 1 truyện bất kỳ',          creditReward: 0.5,  isActive: true },
];

export default async function DailyTasksPage() {
    const savedTasks = await getDailyTasks();
    const savedMap = Object.fromEntries(savedTasks.map((t: any) => [t.taskKey, t]));

    // Merge defaults with saved
    const tasks = DEFAULT_TASKS.map(def => ({
        ...def,
        ...(savedMap[def.taskKey] ?? {}),
    }));

    return (
        <div className="space-y-5 max-w-2xl">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Nhiệm vụ hàng ngày</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Cấu hình phần thưởng credit cho từng nhiệm vụ</p>
            </div>

            <div className="rounded-xl bg-white dark:bg-zinc-800 ring-1 ring-gray-900/5 dark:ring-white/10 divide-y divide-gray-100 dark:divide-zinc-700">
                {tasks.map((task: any) => (
                    <DailyTaskRow key={task.taskKey} task={task} />
                ))}
            </div>
        </div>
    );
}
