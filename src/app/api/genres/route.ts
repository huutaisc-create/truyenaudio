import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'

// GET /api/genres — genres grouped by type, ĐÃ ẩn tag 0 truyện.
//   Mặc định:        { GENRE: ["Tên", ...], ... }               (tương thích app cũ)
//   ?withCount=1:     { GENRE: [{ name, count }, ...], ... }     (app/web bản mới có số đếm)
export async function GET(req: NextRequest) {
  try {
    const withCount = req.nextUrl.searchParams.get('withCount') === '1'

    const genres = await db.genre.findMany({
      select: {
        name: true,
        type: true,
        _count: { select: { stories: { where: { isHidden: false } } } },
      },
    })

    // Gom theo type, dedup không phân biệt hoa/thường (cộng dồn số), bỏ tag 0 truyện.
    const map: Record<string, Map<string, number>> = {}
    for (const g of genres) {
      const c = g._count.stories
      if (c <= 0) continue
      if (!map[g.type]) map[g.type] = new Map()
      let found: string | undefined
      for (const k of map[g.type].keys()) {
        if (k.toLowerCase() === g.name.toLowerCase()) { found = k; break }
      }
      if (found) map[g.type].set(found, map[g.type].get(found)! + c)
      else map[g.type].set(g.name, c)
    }

    const out: Record<string, unknown> = {}
    for (const t of Object.keys(map)) {
      const arr = [...map[t].entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      out[t] = withCount ? arr : arr.map(x => x.name)
    }

    return NextResponse.json(out, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    })
  } catch (error) {
    console.error('GET /api/genres error:', error)
    return NextResponse.json({}, { status: 500 })
  }
}
