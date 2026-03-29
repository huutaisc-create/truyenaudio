// D:\Webtruyen\webtruyen-app\src\app\api\credits\balance\route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getToken } from 'next-auth/jwt'
import db from '@/lib/db'

export async function GET(req: NextRequest) {
  let userId: string | undefined

  const session = await auth()
  if (session?.user?.id) {
    userId = session.user.id
  } else {
    const token = await getToken({ req, secret: process.env.AUTH_SECRET })
    if (token?.sub) userId = token.sub
  }

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      downloadCredits: true,
      lastCheckIn: true,
      currentStreak: true,
      _count: {
        select: { comments: true, reviews: true, nominations: true },
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
    },
  })
}
