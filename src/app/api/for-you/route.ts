import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'

export async function GET(req: NextRequest) {
    const genresParam = req.nextUrl.searchParams.get('genres') ?? ''
    const genres = genresParam.split(',').map(g => g.trim()).filter(Boolean)

    if (genres.length === 0) {
        return NextResponse.json({ stories: [] })
    }

    const stories = await db.story.findMany({
        where: {
            isHidden: false,
            genres: { some: { name: { in: genres } } },
        },
        orderBy: { viewCount: 'desc' },
        take: 8,
        select: {
            id: true,
            title: true,
            slug: true,
            coverImage: true,
            status: true,
        },
    })

    return NextResponse.json({ stories })
}
