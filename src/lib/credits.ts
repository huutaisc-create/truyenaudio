// D:\Webtruyen\webtruyen-app\src\lib\credits.ts
// Gọi hàm này ở server side trước khi cho phép user tải chương

import db from '@/lib/db'

/**
 * Trừ 1 credit để tải chương.
 * Chỉ trừ khi downloadCredits >= 1.0
 *
 * @param userId  - ID của user
 * @param note    - Mô tả giao dịch, vd: "Tải chương 12 - Tên truyện"
 */
export async function spendCredit(
  userId: string,
  note?: string
): Promise<{
  success: boolean
  remainingCredits: number
  message?: string
}> {
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

  // Trừ credits + ghi log trong 1 transaction DB
  const updated = await db.user.update({
    where: { id: userId },
    data: { downloadCredits: { decrement: 1.0 } },
    select: { downloadCredits: true },
  })

  await db.creditTransaction.create({
    data: {
      userId,
      type:         'SPEND',
      amount:       -1.0,
      balanceAfter: updated.downloadCredits,
      note:         note ?? 'Tải chương',
    },
  })

  return {
    success: true,
    remainingCredits: updated.downloadCredits,
  }
}
