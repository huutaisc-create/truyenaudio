/**
 * VACUUM SQLite DB để thu hồi space sau khi xóa cột content
 * Chạy: npx tsx prisma/vacuum-db.ts
 */

import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 Kiểm tra DB size trước VACUUM...')
  
  const chapterCount = await prisma.chapter.count()
  console.log(`📊 Tổng chapters: ${chapterCount}`)
  
  console.log('🧹 Đang chạy VACUUM... (có thể mất 2-5 phút)')
  const start = Date.now()
  
  await prisma.$executeRawUnsafe('VACUUM')
  
  const elapsed = Math.round((Date.now() - start) / 1000)
  console.log(`✅ VACUUM xong! (${elapsed}s)`)
  console.log('\n📊 Kiểm tra DB size mới:')
  console.log('   dir prisma\\dev.db')
}

main()
  .catch(err => {
    console.error('💥 ERROR:', err.message)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
