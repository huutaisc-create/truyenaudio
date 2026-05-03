import { NextResponse } from 'next/server'
import db from '@/lib/db'

// GET /api/genres — trả về genres grouped by type
// Response: { GENRE: [...], BOI_CANH: [...], LUU_PHAI: [...], TINH_CACH: [...], THI_GIAC: [...] }
export async function GET() {
  try {
    const genres = await db.genre.findMany({
      select: { name: true, type: true },
      orderBy: { name: 'asc' },
    })

    const grouped: Record<string, string[]> = {}
    for (const g of genres) {
      if (!grouped[g.type]) grouped[g.type] = []
      const already = grouped[g.type].some(
        n => n.toLowerCase() === g.name.toLowerCase()
      )
      if (!already) grouped[g.type].push(g.name)
    }

    return NextResponse.json(grouped, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' }
    })
  } catch (error) {
    console.error('GET /api/genres error:', error)
    return NextResponse.json({}, { status: 500 })
  }
}
