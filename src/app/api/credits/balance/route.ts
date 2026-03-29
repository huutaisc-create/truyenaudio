import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-helper'
import db from '@/lib/db'

export async function GET(req: NextRequest) {
  const authUser = await getAuthUser(req)
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await db.user.findUnique({
    where: { id: authUser.id },
    select: {
      downloadCredits: true,
      lastCheckIn: true,
      currentStreak: true,
      _count: {
        select: { comments: true, reviews: true, nominations: true },
      },
      creditTransactions: {
        where: { type: { in: ['ADD_APP', 'ADD_WEB'] } },
        select: { id: true },
      },
    },
  })

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  return NextResponse.json({
    success: true,
    data: {
      downloadCredits: user.downloadCredits,
      usableCredits: Math.floor(user.downloadCredits),
      lastCheckIn: user.lastCheckIn?.toISOString() ?? null,
      currentStreak: user.currentStreak ?? 0,
      commentsCount: user._count.comments,
      reviewsCount: user._count.reviews,
      nominationsCount: user._count.nominations,
      videoCount: user.creditTransactions.length,
    },
  })
}
