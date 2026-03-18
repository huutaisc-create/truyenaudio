import { NextResponse } from 'next/server'
import db from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization')
    const isVercelCron = authHeader === `Bearer ${process.env.CRON_SECRET}`

    // ✅ Nếu không có CRON_SECRET trong env → vẫn cho ping (monitor bên ngoài)
    // Nếu có CRON_SECRET trong env → chỉ cho cron hợp lệ hoặc request không có auth (monitor)
    // Logic: chặn request CÓ auth header nhưng sai secret (tấn công giả mạo)
    const hasBadAuth = authHeader && !isVercelCron
    if (hasBadAuth) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const start = Date.now()

    try {
        await db.$queryRaw`SELECT 1`
        const responseTime = Date.now() - start

        const result = {
            ok: true,
            timestamp: new Date().toISOString(),
            responseTime: `${responseTime}ms`,
            source: isVercelCron ? 'vercel-cron' : 'monitor',
            dbStatus: responseTime > 500 ? 'cold-start' : 'warm',
        }

        console.log('[KeepAlive]', JSON.stringify(result))
        return NextResponse.json(result)

    } catch (error) {
        const result = {
            ok: false,
            timestamp: new Date().toISOString(),
            responseTime: `${Date.now() - start}ms`,
            error: 'DB ping failed',
        }
        console.error('[KeepAlive] FAILED', JSON.stringify(result))
        return NextResponse.json(result, { status: 500 })
    }
}
