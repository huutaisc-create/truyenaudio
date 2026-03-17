/**
 * Migration Script: Upload chapter content lên Cloudflare R2 (PARALLEL VERSION)
 * 
 * Chạy: npx tsx prisma/migrate-to-r2.ts
 * 
 * - Upload song song 20 chapters cùng lúc
 * - Idempotent: chạy lại được, skip file đã có
 * - Ước tính: 220k chapters ~ 3-5 tiếng
 */

import { PrismaClient } from '@prisma/client'
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })

// ── Config ──────────────────────────────────────────────
const ACCOUNT_ID    = process.env.R2_ACCOUNT_ID!
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!
const SECRET_KEY    = process.env.R2_SECRET_ACCESS_KEY!
const BUCKET_NAME   = process.env.R2_BUCKET_NAME!
const PUBLIC_URL    = process.env.R2_PUBLIC_URL!

const CONCURRENCY   = 50   // upload 20 chapters đồng thời
const BATCH_SIZE    = 200  // lấy 200 chapters từ DB mỗi lần query

if (!ACCOUNT_ID || !ACCESS_KEY_ID || !SECRET_KEY || !BUCKET_NAME || !PUBLIC_URL) {
  console.error('❌ Thiếu env variables trong .env.local')
  process.exit(1)
}

// ── Init ─────────────────────────────────────────────────
const prisma = new PrismaClient()

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: ACCESS_KEY_ID,
    secretAccessKey: SECRET_KEY,
  },
  maxAttempts: 3,
})

const LOG_FILE = path.join(process.cwd(), 'prisma', 'migrate-to-r2.log')
function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}`
  console.log(line)
  fs.appendFileSync(LOG_FILE, line + '\n')
}

// ── R2 helpers ───────────────────────────────────────────
async function existsOnR2(key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: key }))
    return true
  } catch {
    return false
  }
}

async function uploadToR2(key: string, content: string): Promise<void> {
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: Buffer.from(content, 'utf-8'),
    ContentType: 'text/plain; charset=utf-8',
  }))
}

// ── Semaphore ────────────────────────────────────────────
class Semaphore {
  private count: number
  private queue: (() => void)[] = []
  constructor(count: number) { this.count = count }
  async acquire(): Promise<void> {
    if (this.count > 0) { this.count--; return }
    return new Promise(resolve => this.queue.push(resolve))
  }
  release(): void {
    const next = this.queue.shift()
    if (next) { next() } else { this.count++ }
  }
}

// ── Process 1 chapter ────────────────────────────────────
let startTime = Date.now()

async function processChapter(
  chapter: { id: string; index: number; content: string; story: { slug: string } },
  stats: { success: number; skipped: number; errors: number; processed: number },
  total: number
): Promise<void> {
  const key = `chapters/${chapter.story.slug}/${chapter.index}.txt`
  stats.processed++

  try {
    // Content rỗng → chỉ update URL, không upload
    if (!chapter.content || chapter.content.trim() === '') {
      await prisma.chapter.update({
        where: { id: chapter.id },
        data: { contentUrl: `${PUBLIC_URL}/${key}` }
      })
      stats.skipped++
      return
    }

    // Đã có trên R2 → chỉ update DB
    const alreadyExists = await existsOnR2(key)
    if (alreadyExists) {
      await prisma.chapter.update({
        where: { id: chapter.id },
        data: { contentUrl: `${PUBLIC_URL}/${key}` }
      })
      stats.skipped++
      if (stats.processed % 500 === 0) printProgress(stats, total)
      return
    }

    // Upload lên R2
    await uploadToR2(key, chapter.content)

    // Update DB
    await prisma.chapter.update({
      where: { id: chapter.id },
      data: { contentUrl: `${PUBLIC_URL}/${key}` }
    })
    stats.success++
    if (stats.processed % 100 === 0) printProgress(stats, total)

  } catch (err: any) {
    stats.errors++
    log(`❌ [${stats.processed}/${total}] ERROR: ${key} — ${err.message}`)
  }
}

function printProgress(
  stats: { success: number; skipped: number; errors: number; processed: number },
  total: number
) {
  const pct     = Math.round((stats.processed / total) * 100)
  const elapsed = (Date.now() - startTime) / 1000
  const rate    = stats.processed / elapsed
  const remain  = Math.round((total - stats.processed) / rate)
  const eta     = new Date(Date.now() + remain * 1000).toLocaleTimeString('vi-VN')
  log(`📈 [${stats.processed}/${total}] ${pct}% | ✅${stats.success} ⏭️${stats.skipped} ❌${stats.errors} | tốc độ ${rate.toFixed(1)}/s | còn ~${Math.round(remain/60)}p | ETA ${eta}`)
}

// ── Main ─────────────────────────────────────────────────
async function main() {
  log(`🚀 Bắt đầu migration (PARALLEL x${CONCURRENCY})`)

  const total = await prisma.chapter.count({ where: { contentUrl: null } })
  log(`📊 Tổng chapters cần migrate: ${total}`)

  if (total === 0) {
    log('✅ Tất cả chapters đã migrate rồi!')
    return
  }

  const estMinutes = Math.round(total / (CONCURRENCY * 2) / 60)
  log(`⏱️  Ước tính: ~${estMinutes} phút với ${CONCURRENCY} luồng song song`)

  const stats   = { success: 0, skipped: 0, errors: 0, processed: 0 }
  const sem     = new Semaphore(CONCURRENCY)
  startTime     = Date.now()
  let offset    = 0
  let active: Promise<void>[] = []

  while (true) {
    const chapters = await prisma.chapter.findMany({
      where: { contentUrl: null },
      include: { story: { select: { slug: true } } },
      take: BATCH_SIZE,
      orderBy: { createdAt: 'asc' },
    })

    if (chapters.length === 0) break

    for (const chapter of chapters) {
      await sem.acquire()
      const p = processChapter(chapter as any, stats, total)
        .finally(() => sem.release())
      active.push(p)
    }

    // Flush xong batch trước khi query tiếp
    // (vì where: contentUrl null, sau khi update xong mới query đúng)
    await Promise.allSettled(active)
    active = []
    offset += BATCH_SIZE
  }

  await Promise.allSettled(active)

  const elapsed = Math.round((Date.now() - startTime) / 1000)
  log('\n' + '═'.repeat(60))
  log(`🎉 Migration hoàn tất! (${Math.round(elapsed/60)}p ${elapsed%60}s)`)
  log(`   ✅ Success : ${stats.success}`)
  log(`   ⏭️  Skipped : ${stats.skipped}`)
  log(`   ❌ Errors  : ${stats.errors}`)
  log(`   📊 Total   : ${stats.processed}`)
  log('═'.repeat(60))

  if (stats.errors > 0) {
    log(`\n⚠️  Có ${stats.errors} lỗi — chạy lại script để retry`)
  } else {
    log('\n✅ Bước tiếp theo: npx tsx prisma/drop-content-column.ts')
  }
}

main()
  .catch(err => {
    log(`\n💥 FATAL: ${err.message}`)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
