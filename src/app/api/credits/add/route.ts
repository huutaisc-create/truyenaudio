// D:\Webtruyen\webtruyen-app\src\app\api\credits\add\route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getToken } from 'next-auth/jwt'
import db from '@/lib/db'

const CREDIT_MAP: Record<string, { amount: number; type: string; note: string }> = {
  app: { amount: 1.0,  type: 'ADD_APP', note: 'Xem video rewarded (app)' },
  web: { amount: 0.5,  type: 'ADD_WEB', note: 'Xem video rewarded (web)' },
}

export async function POST(req: NextRequest) {
  // Auth: thử NextAuth session trước, fallback sang JWT
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

  const body = await req.json().catch(() => ({}))
  const source: string = body.source // 'app' | 'web'
  const config = CREDIT_MAP[source]

  if (!config) {
    return NextResponse.json(
      { error: 'source phải là "app" hoặc "web"' },
      { status: 400 }
    )
  }

  // Dùng transaction DB: cập nhật credits + ghi log trong 1 lần
  const [updated] = await db.$transaction([
    db.user.update({
      where: { id: userId },
      data: { downloadCredits: { increment: config.amount } },
      select: { downloadCredits: true },
    }),
  ])

  // Ghi log sau khi có balanceAfter
  await db.creditTransaction.create({
    data: {
      userId,
      type:         config.type,
      amount:       config.amount,
      balanceAfter: updated.downloadCredits,
      note:         config.note,
    },
  })

  return NextResponse.json({
    downloadCredits: updated.downloadCredits,
    usableCredits:   Math.floor(updated.downloadCredits),
    added:           config.amount,
  })
}
