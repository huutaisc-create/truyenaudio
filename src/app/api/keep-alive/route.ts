import { NextResponse } from 'next/server'
import db from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization')
    const isVercelCron = authHeader === `Bearer ${process.env.CRON_SECRET}`
    const isManualCheck = request.headers.get('x-manual-check') === 'true'

    // Chặn request không hợp lệ
    if (!isVercelCron && !isManualCheck) {
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
            source: isVercelCron ? 'vercel-cron' : 'manual',
            // Nếu > 500ms → DB vừa cold start
            dbStatus: responseTime > 500 ? 'cold-start' : 'warm',
        }

        // Log ra Vercel — xem trong Dashboard > Logs
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
