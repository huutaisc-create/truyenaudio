import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-helper'
import { rewardCredit } from '@/lib/credits'
import db from '@/lib/db'

const MAX_STORIES_PER_DAY = 5

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const authUser = await getAuthUser(req)
  if (!authUser) return NextResponse.json({ error: 'Bạn cần đăng nhập để đánh giá.' }, { status: 401 })

  const body = await req.json()
  const rating = Number(body.rating)
  const content = (body.content ?? '').trim()

  if (!rating || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'Rating phải từ 1 đến 5 sao.' }, { status: 400 })
  }

  const story = await db.story.findUnique({
    where: { slug },
    select: { id: true, title: true, slug: true, ratingScore: true, ratingCount: true },
  })
  if (!story) return NextResponse.json({ error: 'Story not found' }, { status: 404 })

  // ── Đã review all-time → block ──
  const alreadyReviewed = await db.review.findFirst({
    where: { userId: authUser.id, storyId: story.id },
    select: { id: true },
  })
  if (alreadyReviewed) {
    return NextResponse.json({
      success: false,
      blocked: true,
      blockReason: 'ALREADY_REVIEWED',
      error: 'Bạn đã đánh giá truyện này rồi.',
    }, { status: 409 })
  }

  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)
  const tomorrow = new Date(todayStart)
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  const secsUntilMidnight = Math.ceil((tomorrow.getTime() - Date.now()) / 1000)

  const txsToday = await db.creditTransaction.findMany({
    where: {
      userId: authUser.id,
      type: 'REWARD_REVIEW',
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
  const isOverDailyLimit = distinctStoryIds.size >= MAX_STORIES_PER_DAY
  const remainingSlots = MAX_STORIES_PER_DAY - distinctStoryIds.size

  // ── Lưu review + cập nhật ratingScore ──
  await db.$transaction(async (tx) => {
    await tx.review.create({ data: { userId: authUser.id, storyId: story.id, rating, content } })
    const currentScore = story.ratingScore ?? 0
    const currentCount = story.ratingCount || 0
    const newCount = currentCount + 1
    const newScore = ((currentScore * currentCount) + rating) / newCount
    await tx.story.update({
      where: { id: story.id },
      data: { ratingCount: newCount, ratingScore: parseFloat(newScore.toFixed(2)) },
    })
  })

  if (isOverDailyLimit) {
    return NextResponse.json({
      success: true,
      credited: false,
      cooldownSeconds: secsUntilMidnight,
      creditMessage: 'Lượt nhận credit hôm nay của bạn đã hết. Cảm ơn bạn đã đánh giá',
    }, { status: 201 })
  }

  const rewardResult = await rewardCredit(
    authUser.id,
    'REWARD_REVIEW',
    `Đánh giá truyện: ${story.title ?? 'Unknown'}`,
    { content, amount: 0.2, maxPerDay: MAX_STORIES_PER_DAY, minLength: 21, storyId: story.id, cooldownSeconds: 0 }
  )

  let creditMessage: string
  if (rewardResult.rewarded) {
    const slotsLeft = remainingSlots - 1
    creditMessage = slotsLeft > 0
      ? `Bạn nhận được +0.2 credit · Còn ${slotsLeft} lượt đánh giá cho truyện khác`
      : `Bạn nhận được +0.2 credit · Đã dùng hết 5 lượt hôm nay 🎉`
  } else {
    creditMessage = content.length <= 20
      ? 'Đánh giá đã lưu · Cần hơn 20 ký tự để nhận credit'
      : 'Lượt nhận credit hôm nay của bạn đã hết. Cảm ơn bạn đã đánh giá'
  }

  return NextResponse.json({
    success: true,
    credited: rewardResult.rewarded,
    creditMessage,
    cooldownSeconds: secsUntilMidnight,
  }, { status: 201 })
}
