// D:\Webtruyen\webtruyen-app\src\lib\credits.ts

import db from '@/lib/db'

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
  | { rewarded: true }
  | { rewarded: false; reason: string }

/**
 * Thưởng credit cho tương tác.
 *
 * options:
 *   content         — text để check độ dài (undefined = bỏ qua check)
 *   amount          — credit thưởng (default 0.2)
 *   maxPerDay       — giới hạn lần/ngày (default 5)
 *   minLength       — ký tự tối thiểu (default 20, 0 = bỏ qua)
 *   storyId         — nếu truyền → check chưa được thưởng type này ở truyện này hôm nay
 *   cooldownSeconds — cooldown giữa 2 lần liên tiếp tính bằng giây (0 = bỏ qua)
 */
export async function rewardCredit(
  userId: string,
  type: RewardType,
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

  // 0h00 hôm nay UTC
  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)

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
        }
      }
    }
  }

  // 3. Check đã thưởng ở truyện này hôm nay chưa (phải ở truyện khác nhau)
  if (storyId) {
    const alreadyRewarded = await db.creditTransaction.findFirst({
      where: {
        userId,
        type,
        note: { contains: storyId },
        createdAt: { gte: todayStart },
      },
    })
    if (alreadyRewarded) {
      return {
        rewarded: false,
        reason: 'Bạn đã nhận thưởng cho truyện này hôm nay rồi',
      }
    }
  }

  // 4. Check tổng số lần nhận thưởng hôm nay
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

  // 5. Cộng credit + ghi log
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
      note,
    },
  })

  return { rewarded: true }
}

function labelForType(type: RewardType): string {
  switch (type) {
    case 'REWARD_COMMENT':    return 'bình luận'
    case 'REWARD_REVIEW':     return 'đánh giá'
    case 'REWARD_NOMINATION': return 'đề cử'
    case 'REWARD_LIKE':       return 'yêu thích'
  }
}
