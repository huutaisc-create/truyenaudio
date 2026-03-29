import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getAuthUser } from '@/lib/auth-helper';

export async function GET(req: Request) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get('page') || 1));
    const limit = Math.min(Number(searchParams.get('limit') || 20), 100);
    const filter = searchParams.get('filter') || 'all';

    const skip = (page - 1) * limit;

    const whereClause: any = { userId: authUser.id };

    if (filter === 'add') {
      whereClause.type = { in: ['ADD_APP', 'ADD_WEB', 'REWARD_COMMENT', 'REWARD_REVIEW', 'REWARD_NOMINATION'] };
    } else if (filter === 'spend') {
      whereClause.type = 'SPEND';
    }

    const [transactions, total] = await Promise.all([
      db.creditTransaction.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          type: true,
          amount: true,
          balanceAfter: true,
          note: true,
          createdAt: true,
        },
      }),
      db.creditTransaction.count({ where: whereClause }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        transactions: transactions.map(t => ({
          id: t.id,
          type: t.type,
          amount: t.amount,
          balanceAfter: t.balanceAfter,
          note: t.note,
          createdAt: t.createdAt.toISOString(),
        })),
        hasMore: skip + limit < total,
        total,
        page,
      },
    });
  } catch (error) {
    console.error('GET credit history error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
