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
    select: { downloadCredits: true },
  })

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  return NextResponse.json({
    downloadCredits: user.downloadCredits,            // Số thực, vd: 1.5
    usableCredits:   Math.floor(user.downloadCredits), // Số có thể dùng, vd: 1
  })
}
