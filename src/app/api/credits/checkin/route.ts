// src/app/api/credits/checkin/route.ts
import { NextResponse, NextRequest } from 'next/server'
import { getAuthUser } from '@/lib/auth-helper'
import db from '@/lib/db'
import { getTaskReward } from '@/lib/credits'

const CHECKIN_BASE_DEFAULT = 0.5
const STREAK_BONUS         = 3.0
const STREAK_MILESTONE     = 7

export async function POST(req: NextRequest) {
  const authUser = await getAuthUser(req)
  if (!authUser) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
  }

  const CHECKIN_BASE = await getTaskReward('CHECK_IN', CHECKIN_BASE_DEFAULT)

  const user = await db.user.findUnique({
    where: { id: authUser.id },
    select: {
      downloadCredits: true,
      lastCheckIn:     true,
      currentStreak:   true,
    },
  })
  if (!user) {
    return NextResponse.json({ error: 'Không tìm thấy tài khoản' }, { status: 404 })
  }

  // So sánh theo ngày (timezone VN = UTC+7)
  const nowUTC   = new Date()
  const nowVN    = new Date(nowUTC.getTime() + 7 * 60 * 60 * 1000)
  const todayVN  = new Date(Date.UTC(nowVN.getUTCFullYear(), nowVN.getUTCMonth(), nowVN.getUTCDate()))

  if (user.lastCheckIn) {
    const lastVN   = new Date(user.lastCheckIn.getTime() + 7 * 60 * 60 * 1000)
    const lastDay  = new Date(Date.UTC(lastVN.getUTCFullYear(), lastVN.getUTCMonth(), lastVN.getUTCDate()))
    const diffDays = Math.round((todayVN.getTime() - lastDay.getTime()) / 86_400_000)

    if (diffDays === 0) {
      return NextResponse.json({ error: 'Hôm nay bạn đã điểm danh rồi!' }, { status: 409 })
    }
  }

  // Tính streak mới
  let newStreak = 1
  if (user.lastCheckIn) {
    const lastVN   = new Date(user.lastCheckIn.getTime() + 7 * 60 * 60 * 1000)
    const lastDay  = new Date(Date.UTC(lastVN.getUTCFullYear(), lastVN.getUTCMonth(), lastVN.getUTCDate()))
    const diffDays = Math.round((todayVN.getTime() - lastDay.getTime()) / 86_400_000)
    newStreak = diffDays === 1 ? (user.currentStreak + 1) : 1
  }

  const isBonus    = newStreak % STREAK_MILESTONE === 0
  const earned     = CHECKIN_BASE + (isBonus ? STREAK_BONUS : 0)
  const newBalance = Math.round((user.downloadCredits + earned) * 10) / 10

  const [updatedUser] = await db.$transaction([
    db.user.update({
      where: { id: authUser.id },
      data: {
        downloadCredits: newBalance,
        lastCheckIn:     todayVN,
        currentStreak:   newStreak,
      },
    }),
    db.creditTransaction.create({
      data: {
        userId: authUser.id,
        type:        'ADD_WEB',
        amount:      earned,
        balanceAfter: newBalance,
        note: isBonus
          ? `Điểm danh hằng ngày 🔥 Streak ${newStreak} — Bonus x7!`
          : `Điểm danh hằng ngày 🔥 Streak ${newStreak}`,
      },
    }),
  ])

  return NextResponse.json({
    success: true,
    data: {
      downloadCredits: newBalance,
      currentStreak:   newStreak,
      earned,
      isBonus,
      creditMessage: isBonus
        ? `🎉 Streak ${newStreak} ngày! Nhận +${earned.toFixed(1)} credit (gồm bonus +${STREAK_BONUS})!`
        : `✓ Điểm danh thành công! Streak ${newStreak} ngày · +${earned.toFixed(1)} credit`,
    },
  })
}
