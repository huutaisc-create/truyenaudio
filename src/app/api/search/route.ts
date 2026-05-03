import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import { Prisma } from '@prisma/client'

// GET /api/search
// Query params:
//   keyword, genres (comma-sep), boiCanh (comma-sep), luuPhai (comma-sep),
//   tinhCach (comma-sep), thiGiac (comma-sep),
//   status (comma-sep: "Đang Ra","Hoàn Thành","Dịch","Convert"),
//   minChapters, maxChapters,
//   sortBy (hot|new|rating|nominated),
//   page, limit

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams

    const keyword      = sp.get('keyword')?.trim() || undefined
    const genresRaw    = sp.get('genres')
    const boiCanhRaw   = sp.get('boiCanh')
    const luuPhaiRaw   = sp.get('luuPhai')
    const tinhCachRaw  = sp.get('tinhCach')
    const thiGiacRaw   = sp.get('thiGiac')
    const statusRaw    = sp.get('status')
    const sortBy       = sp.get('sortBy') || 'hot'
    const page         = Math.max(1, parseInt(sp.get('page') || '1'))
    const limit        = Math.min(40, parseInt(sp.get('limit') || '20'))

    const minChapters  = sp.get('minChapters') ? parseInt(sp.get('minChapters')!) : undefined
    const maxChapters  = sp.get('maxChapters') ? parseInt(sp.get('maxChapters')!) : undefined

    const parse = (raw: string | null) =>
      raw ? raw.split(',').map(s => s.trim()).filter(Boolean) : []

    const genres   = parse(genresRaw)
    const boiCanh  = parse(boiCanhRaw)
    const luuPhai  = parse(luuPhaiRaw)
    const tinhCach = parse(tinhCachRaw)
    const thiGiac  = parse(thiGiacRaw)
    const status   = parse(statusRaw)

    const offset = (page - 1) * limit
    const where: Prisma.StoryWhereInput = { isHidden: false }

    // Keyword search (unaccent)
    if (keyword) {
      const kw = `%${keyword}%`
      const matchingIds = await db.$queryRaw<{ id: string }[]>(
        Prisma.sql`
          SELECT id FROM "Story"
          WHERE "isHidden" = false
            AND unaccent(lower(title)) ILIKE unaccent(lower(${kw}))
        `
      )
      const ids = matchingIds.map(r => r.id)
      where.id = { in: ids.length > 0 ? ids : ['__no_match__'] }
    }

    // Genre filters (AND logic — phải có tất cả genre được chọn)
    const andConditions: Prisma.StoryWhereInput[] = []
    genres.forEach(g =>
      andConditions.push({ genres: { some: { name: { contains: g }, type: 'GENRE' } } })
    )
    boiCanh.forEach(b =>
      andConditions.push({ genres: { some: { name: { contains: b }, type: 'BOI_CANH' } } })
    )
    luuPhai.forEach(l =>
      andConditions.push({ genres: { some: { name: { contains: l }, type: 'LUU_PHAI' } } })
    )
    tinhCach.forEach(t =>
      andConditions.push({ genres: { some: { name: { contains: t }, type: 'TINH_CACH' } } })
    )
    thiGiac.forEach(t =>
      andConditions.push({ genres: { some: { name: { contains: t }, type: 'THI_GIAC' } } })
    )
    if (andConditions.length > 0) where.AND = andConditions

    // Status
    if (status.length > 0) {
      const statusMap: Record<string, string> = {
        'Đang Ra': 'ONGOING', 'Hoàn Thành': 'COMPLETED',
        'Dịch': 'TRANSLATED', 'Convert': 'CONVERTED',
      }
      where.status = { in: status.map(s => statusMap[s] || s) }
    }

    // Chapter range
    if (minChapters !== undefined || maxChapters !== undefined) {
      const cf: Prisma.IntFilter = {}
      if (minChapters !== undefined) cf.gte = minChapters
      if (maxChapters !== undefined) cf.lte = maxChapters
      where.totalChapters = cf
    }

    // Sort
    let orderBy: Prisma.StoryOrderByWithRelationInput = { viewCount: 'desc' }
    if (sortBy === 'new' || sortBy === 'Mới Cập Nhật') orderBy = { updatedAt: 'desc' }
    else if (sortBy === 'rating' || sortBy === 'Đánh Giá') orderBy = { ratingScore: 'desc' }
    else if (sortBy === 'nominated' || sortBy === 'Đề Cử') orderBy = { nominationCount: 'desc' }

    const [stories, total] = await Promise.all([
      db.story.findMany({
        where, orderBy, take: limit, skip: offset,
        select: {
          id: true, title: true, slug: true, coverImage: true,
          author: true, status: true, viewCount: true,
          ratingScore: true, ratingCount: true, totalChapters: true,
          genres: { select: { name: true, type: true }, take: 3 },
        }
      }),
      db.story.count({ where })
    ])

    return NextResponse.json({
      stories: stories.map(s => ({
        ...s,
        categories: s.genres.filter(g => g.type === 'GENRE').map(g => g.name),
      })),
      pagination: { total, page, totalPages: Math.ceil(total / limit) }
    })
  } catch (error) {
    console.error('GET /api/search error:', error)
    return NextResponse.json({ stories: [], pagination: { total: 0, page: 1, totalPages: 0 } }, { status: 500 })
  }
}
