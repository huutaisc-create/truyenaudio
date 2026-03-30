// D:\Webtruyen\webtruyen-app\src\lib\credits.ts

import db from '@/lib/db'
import { getVnTodayStart } from '@/lib/date-vn'

/**
 * Trừ 1 credit để tải chương.
 */
export async function spendCredit(
  userId: string,
  note?: string
): Promise<{ success: boolean; remainingCredits: number; message?: string }> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { downloadCredits: true },
  })

  if (!user) {
    return { success: false, remainingCredits: 0, message: 'User not found' }
  }

  if (user.downloadCredits < 1.0) {
    return {
      success: false,
      remainingCredits: user.downloadCredits,
      message: 'Không đủ credits. Xem thêm video để nhận credits.',
    }
  }

  const updated = await db.user.update({
    where: { id: userId },
    data: { downloadCredits: { decrement: 1.0 } },
    select: { downloadCredits: true },
  })

  await db.creditTransaction.create({
    data: {
      userId,
      type: 'SPEND',
      amount: -1.0,
      balanceAfter: updated.downloadCredits,
      note: note ?? 'Tải chương',
    },
  })

  return { success: true, remainingCredits: updated.downloadCredits }
}

// ─────────────────────────────────────────────────────────────

export type RewardType =
  | 'REWARD_COMMENT'
  | 'REWARD_REVIEW'
  | 'REWARD_NOMINATION'
  | 'REWARD_LIKE'

export type RewardResult =
  | { rewarded: true; newBalance: number; usable: number }
  | { rewarded: false; reason: string; cooldownSeconds?: number }

/**
 * Thưởng credit cho tương tác.
 *
 * options:
 *   content         — text để check độ dài (undefined = bỏ qua check)
 *   amount          — credit thưởng (default 0.2)
 *   maxPerDay       — giới hạn số truyện khác nhau/ngày (default 5)
 *   minLength       — ký tự tối thiểu (default 20, 0 = bỏ qua)
 *   storyId         — nếu truyền → check chưa được thưởng type này ở truyện này hôm nay
 *                     VÀ check tổng số truyện khác nhau hôm nay
 *   cooldownSeconds — cooldown giữa 2 lần liên tiếp tính bằng giây (0 = bỏ qua)
 *
 * NOTE về note format: KHÔNG embed storyId vào note để hiển thị cho user.
 * storyId được lưu riêng trong field storyId (nếu schema có) hoặc dùng
 * query distinct. Ở đây ta dùng note chứa storyId nhưng TÁCH BIỆT với
 * phần hiển thị — caller truyền displayNote riêng.
 */
export async function rewardCredit(
  userId: string,
  type: RewardType,
  /** Note lưu vào DB — nên là text thân thiện, KHÔNG có storyId raw */
  note: string,
  options?: {
    content?: string
    amount?: number
    maxPerDay?: number
    minLength?: number
    storyId?: string
    cooldownSeconds?: number
  }
): Promise<RewardResult> {
  const amount          = options?.amount          ?? 0.2
  const maxPerDay       = options?.maxPerDay       ?? 5
  const minLength       = options?.minLength       ?? 20
  const content         = options?.content
  const storyId         = options?.storyId
  const cooldownSeconds = options?.cooldownSeconds ?? 0

  // 1. Check độ dài tối thiểu
  if (content !== undefined && minLength > 0 && content.trim().length < minLength) {
    return {
      rewarded: false,
      reason: `Nội dung quá ngắn (cần tối thiểu ${minLength} ký tự để nhận thưởng)`,
    }
  }

  // 0h00 hôm nay giờ VN (UTC+7)
  const todayStart = getVnTodayStart()

  // 2. Check cooldown — lấy giao dịch gần nhất của type này
  if (cooldownSeconds > 0) {
    const lastTx = await db.creditTransaction.findFirst({
      where: { userId, type },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    })
    if (lastTx) {
      const secondsSinceLast = (Date.now() - lastTx.createdAt.getTime()) / 1000
      if (secondsSinceLast < cooldownSeconds) {
        const remaining = Math.ceil(cooldownSeconds - secondsSinceLast)
        return {
          rewarded: false,
          reason: `Vui lòng chờ ${remaining} giây trước khi bình luận tiếp`,
          cooldownSeconds: remaining,
        }
      }
    }
  }

  // 3. Check đã thưởng ở truyện này hôm nay chưa
  if (storyId) {
    const alreadyRewarded = await db.creditTransaction.findFirst({
      where: {
        userId,
        type,
        // Dùng metadata field nếu có, hoặc note pattern an toàn hơn
        note: { startsWith: `[story:${storyId}]` },
        createdAt: { gte: todayStart },
      },
    })
    if (alreadyRewarded) {
      return {
        rewarded: false,
        reason: 'Bạn đã nhận thưởng cho truyện này hôm nay rồi',
      }
    }

    // 4. BUG FIX: Đếm số TRUYỆN KHÁC NHAU đã nhận thưởng hôm nay
    // (không phải tổng số lần)
    const txsToday = await db.creditTransaction.findMany({
      where: {
        userId,
        type,
        note: { startsWith: '[story:' },
        createdAt: { gte: todayStart },
      },
      select: { note: true },
    })

    // Extract storyId từ note pattern "[story:xxx] ..."
    // NẾU note null hoặc không match pattern → tính là 1 entry riêng (an toàn hơn,
    // tránh bypass giới hạn do DB row cũ / note format khác)
    const distinctStoryIds = new Set(
      txsToday.map((tx, idx) => {
        const match = tx.note?.match(/^\[story:([^\]]+)\]/)
        // match thành công → dùng storyId; không match → dùng fallback key duy nhất
        return match ? match[1] : `__unknown_${idx}`
      })
    )

    if (distinctStoryIds.size >= maxPerDay) {
      return {
        rewarded: false,
        reason: `Bạn đã nhận thưởng từ ${maxPerDay} truyện khác nhau hôm nay. Hẹn gặp lại ngày mai! 🎉`,
      }
    }
  } else {
    // Không có storyId → đếm tổng số lần (cho các type không cần storyId)
    const countToday = await db.creditTransaction.count({
      where: {
        userId,
        type,
        createdAt: { gte: todayStart },
      },
    })
    if (countToday >= maxPerDay) {
      return {
        rewarded: false,
        reason: `Bạn đã dùng đủ ${maxPerDay} lượt ${labelForType(type)} hôm nay. Hẹn gặp lại ngày mai! 🎉`,
      }
    }
  }

  // 5. Cộng credit + ghi log
  // Note format: "[story:storyId] text thân thiện" — storyId ẩn trong prefix,
  // phần hiển thị cho user chỉ thấy text sau prefix
  const dbNote = storyId ? `[story:${storyId}] ${note}` : note

  const updated = await db.user.update({
    where: { id: userId },
    data: { downloadCredits: { increment: amount } },
    select: { downloadCredits: true },
  })

  await db.creditTransaction.create({
    data: {
      userId,
      type,
      amount,
      balanceAfter: updated.downloadCredits,
      note: dbNote,
    },
  })

  return {
    rewarded: true,
    newBalance: updated.downloadCredits,
    usable: Math.floor(updated.downloadCredits),
  }
}

function labelForType(type: RewardType): string {
  switch (type) {
    case 'REWARD_COMMENT':    return 'bình luận'
    case 'REWARD_REVIEW':     return 'đánh giá'
    case 'REWARD_NOMINATION': return 'đề cử'
    case 'REWARD_LIKE':       return 'yêu thích'
  }
}
