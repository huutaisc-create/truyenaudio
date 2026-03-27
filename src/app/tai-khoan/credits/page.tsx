// D:\Webtruyen\webtruyen-app\src\app\tai-khoan\credits\page.tsx
import { auth } from '@/auth'
import db from '@/lib/db'
import { redirect } from 'next/navigation'
import CreditHubClient from './CreditHubClient'

export default async function CreditsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const userId = session.user.id

  // Fetch song song để nhanh
  const [user, transactions, storyRequests] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: {
        id:              true,
        name:            true,
        image:           true,
        chaptersRead:    true,
        downloadCredits: true,
        lastCheckIn:     true,
        currentStreak:   true,
        createdAt:       true,
        _count: {
          select: {
            comments:      true,
            reviews:       true,
            nominations:   true,
          },
        },
      },
    }),

    db.creditTransaction.findMany({
      where:   { userId },
      orderBy: { createdAt: 'desc' },
      take:    30,
    }),

    db.storyRequest.findMany({
      where:   { userId },
      orderBy: { createdAt: 'desc' },
      take:    10,
      include: {
        story: {
          select: { slug: true, title: true, coverImage: true },
        },
      },
    }),
  ])

  if (!user) redirect('/login')

  return (
    <CreditHubClient
      user={{
        id:              user.id,
        name:            user.name ?? 'Người dùng',
        image:           user.image ?? null,
        chaptersRead:    user.chaptersRead,
        downloadCredits: user.downloadCredits,
        lastCheckIn:     user.lastCheckIn ? user.lastCheckIn.toISOString() : null,
        currentStreak:   user.currentStreak,
        createdAt:       user.createdAt.toISOString(),
        commentsCount:   user._count.comments,
        reviewsCount:    user._count.reviews,
        nominationsCount:user._count.nominations,
      }}
      transactions={transactions.map(t => ({
        id:          t.id,
        type:        t.type,
        amount:      t.amount,
        balanceAfter:t.balanceAfter,
        note:        t.note ?? '',
        createdAt:   t.createdAt.toISOString(),
      }))}
      storyRequests={storyRequests.map(r => ({
        id:        r.id,
        title:     r.title,
        status:    r.status,
        createdAt: r.createdAt.toISOString(),
        story:     r.story ? { slug: r.story.slug, title: r.story.title } : null,
      }))}
    />
  )
}
