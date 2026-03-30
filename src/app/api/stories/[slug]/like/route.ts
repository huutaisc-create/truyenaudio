import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-helper'
import db from '@/lib/db'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const authUser = await getAuthUser(req)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const story = await db.story.findUnique({ where: { slug }, select: { id: true } })
    if (!story) return NextResponse.json({ error: 'Story not found' }, { status: 404 })

    const existing = await db.like.findUnique({
      where: { userId_storyId: { userId: authUser.id, storyId: story.id } },
      select: { id: true },
    })

    const result = await db.$transaction(async (tx) => {
      if (existing) {
        await tx.like.delete({ where: { id: existing.id } })
        const updated = await tx.story.update({
          where: { id: story.id },
          data: { likeCount: { decrement: 1 } },
          select: { likeCount: true },
        })
        return { liked: false, likeCount: updated.likeCount }
      } else {
        await tx.like.create({ data: { userId: authUser.id, storyId: story.id } })
        const updated = await tx.story.update({
          where: { id: story.id },
          data: { likeCount: { increment: 1 } },
          select: { likeCount: true },
        })
        return { liked: true, likeCount: updated.likeCount }
      }
    })

    return NextResponse.json({ success: true, liked: result.liked, likeCount: result.likeCount })
  } catch (error) {
    console.error('Like route error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
