import { NextResponse } from 'next/server'
import db from '@/lib/db'

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`
    return NextResponse.json({ ok: true, time: new Date().toISOString() })
  } catch (e) {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
