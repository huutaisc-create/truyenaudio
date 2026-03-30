import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-helper'
import db from '@/lib/db'
import { getVnTodayStart } from '@/lib/date-vn'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const authUser = await getAuthUser(req)

  const story = await db.story.findUnique({
    where: { slug },
    select: { id: true, likeCount: true, followCount: true, nominationCount: true },
  })
  if (!story) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let userStatus = {
    isLiked: false,
    isFollowed: false,
    isNominatedToday: false,
    commentedToday: false,
    hasReviewed: false,
  }

  if (authUser) {
    const todayStart = getVnTodayStart()

    const [lib, like, nomToday, commentedTodayTx, review] = await Promise.all([
      db.library.findUnique({
        where: { userId_storyId: { userId: authUser.id, storyId: story.id } },
        select: { id: true },
      }),
      db.like.findUnique({
        where: { userId_storyId: { userId: authUser.id, storyId: story.id } },
        select: { id: true },
      }),
      db.nomination.findFirst({
        where: { userId: authUser.id, storyId: story.id, createdAt: { gte: todayStart } },
        select: { id: true },
      }),
      db.creditTransaction.findFirst({
        where: {
          userId: authUser.id,
          type: 'REWARD_COMMENT',
          note: { startsWith: `[story:${story.id}]` },
          createdAt: { gte: todayStart },
        },
        select: { id: true },
      }),
      // hasReviewed: all-time (không giới hạn ngày)
      db.review.findFirst({
        where: { userId: authUser.id, storyId: story.id },
        select: { id: true },
      }),
    ])

    userStatus.isLiked = !!like
    userStatus.isFollowed = !!lib
    userStatus.isNominatedToday = !!nomToday
    userStatus.commentedToday = !!commentedTodayTx
    userStatus.hasReviewed = !!review
  }

  return NextResponse.json({
    success: true,
    data: {
      stats: {
        likeCount: story.likeCount,
        followCount: story.followCount,
        nominationCount: story.nominationCount,
      },
      userStatus,
    },
  })
}
