import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-helper'
import { rewardCredit } from '@/lib/credits'
import db from '@/lib/db'
import { getVnTodayStart, secsUntilVnMidnight } from '@/lib/date-vn'

const MAX_STORIES_PER_DAY = 5

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const authUser = await getAuthUser(req)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const story = await db.story.findUnique({ where: { slug }, select: { id: true, title: true } })
  if (!story) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const todayStart = getVnTodayStart()
  const secsUntilMidnight = secsUntilVnMidnight()

  const txsToday = await db.creditTransaction.findMany({
    where: {
      userId: authUser.id,
      type: 'REWARD_NOMINATION',
      note: { startsWith: '[story:' },
      createdAt: { gte: todayStart },
    },
    select: { note: true },
  })

  const distinctStoryIds = new Set(
    txsToday.map((tx, idx) => {
      const match = tx.note?.match(/^\[story:([^\]]+)\]/)
      return match ? match[1] : `__unknown_${idx}`
    })
  )

  const alreadyThisStory = distinctStoryIds.has(story.id)
  const isOverDailyLimit = distinctStoryIds.size >= MAX_STORIES_PER_DAY
  const remainingSlots = MAX_STORIES_PER_DAY - distinctStoryIds.size

  if (alreadyThisStory) {
    const slotsLeft = MAX_STORIES_PER_DAY - distinctStoryIds.size
    return NextResponse.json({
      success: false,
      blocked: true,
      blockReason: 'SAME_STORY_TODAY',
      cooldownSeconds: secsUntilMidnight,
      remainingSlots: slotsLeft,
      creditMessage: `Hãy quay lại vào ngày mai nhé, bạn còn ${slotsLeft} lượt đề cử cho truyện khác`,
    })
  }

  // Lưu nomination + tăng counter
  await db.$transaction([
    db.nomination.create({ data: { userId: authUser.id, storyId: story.id } }),
    db.story.update({ where: { id: story.id }, data: { nominationCount: { increment: 1 } } }),
  ])

  if (isOverDailyLimit) {
    return NextResponse.json({
      success: true,
      credited: false,
      cooldownSeconds: secsUntilMidnight,
      remainingSlots: 0,
      creditMessage: 'Lượt nhận credit hôm nay của bạn đã hết. Cảm ơn bạn đã đề cử',
    })
  }

  const rewardResult = await rewardCredit(
    authUser.id,
    'REWARD_NOMINATION',
    `Đề cử truyện: ${story.title ?? 'Unknown'}`,
    { amount: 0.2, maxPerDay: MAX_STORIES_PER_DAY, minLength: 0, storyId: story.id, cooldownSeconds: 0 }
  )

  const slotsLeft = remainingSlots - 1
  const creditMessage = rewardResult.rewarded
    ? slotsLeft > 0
      ? `Bạn nhận được +0.2 credit · Còn ${slotsLeft} lượt đề cử cho truyện khác`
      : `Bạn nhận được +0.2 credit · Đã dùng hết 5 lượt hôm nay 🎉`
    : 'Lượt nhận credit hôm nay của bạn đã hết. Cảm ơn bạn đã đề cử'

  // Lấy nominationCount mới nhất
  const updated = await db.story.findUnique({ where: { id: story.id }, select: { nominationCount: true } })

  return NextResponse.json({
    success: true,
    credited: rewardResult.rewarded,
    remainingSlots: rewardResult.rewarded ? Math.max(0, slotsLeft) : 0,
    creditMessage,
    cooldownSeconds: secsUntilMidnight,
    nominationCount: updated?.nominationCount,
  })
}
