/**
 * Drop content column sau khi migrate xong lên R2
 * Chạy: npx tsx prisma/drop-content-column.ts
 */

import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 Kiểm tra trước khi xóa cột content...')

  const missing = await prisma.chapter.count({
    where: { contentUrl: null }
  })

  if (missing > 0) {
    console.error(`❌ Còn ${missing} chapters chưa có contentUrl!`)
    process.exit(1)
  }

  const total = await prisma.chapter.count()
  console.log(`✅ Tất cả ${total} chapters đã có contentUrl`)
  console.log('🗑️  Đang xóa cột content...')

  // Tạo bảng mới không có cột content
  // Dùng "idx" thay vì "index" để tránh reserved keyword
  await prisma.$executeRawUnsafe(`
    CREATE TABLE "Chapter_new" (
      "id"          TEXT PRIMARY KEY,
      "idx"         INTEGER NOT NULL,
      "title"       TEXT NOT NULL,
      "contentUrl"  TEXT,
      "viewCount"   INTEGER NOT NULL DEFAULT 0,
      "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"   DATETIME NOT NULL,
      "storyId"     TEXT NOT NULL,
      FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE
    )
  `)

  // Copy data sang bảng mới
  await prisma.$executeRawUnsafe(`
    INSERT INTO "Chapter_new" ("id", "idx", "title", "contentUrl", "viewCount", "createdAt", "updatedAt", "storyId")
    SELECT "id", "index", "title", "contentUrl", "viewCount", "createdAt", "updatedAt", "storyId"
    FROM "Chapter"
  `)

  // Đổi tên cột idx về index bằng cách tạo bảng final
  await prisma.$executeRawUnsafe(`
    CREATE TABLE "Chapter_final" (
      "id"          TEXT PRIMARY KEY,
      "index"       INTEGER NOT NULL,
      "title"       TEXT NOT NULL,
      "contentUrl"  TEXT,
      "viewCount"   INTEGER NOT NULL DEFAULT 0,
      "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"   DATETIME NOT NULL,
      "storyId"     TEXT NOT NULL,
      FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE
    )
  `)

  await prisma.$executeRawUnsafe(`
    INSERT INTO "Chapter_final"
    SELECT "id", "idx", "title", "contentUrl", "viewCount", "createdAt", "updatedAt", "storyId"
    FROM "Chapter_new"
  `)

  await prisma.$executeRawUnsafe(`DROP TABLE "Chapter"`)
  await prisma.$executeRawUnsafe(`DROP TABLE "Chapter_new"`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "Chapter_final" RENAME TO "Chapter"`)
  await prisma.$executeRawUnsafe(`CREATE INDEX "Chapter_storyId_index_idx" ON "Chapter"("storyId", "index")`)

  console.log('✅ Đã xóa cột content thành công!')
  console.log('\n📊 Kiểm tra DB size:')
  console.log('   dir prisma\\dev.db')
  console.log('\n✅ Bước tiếp theo: cập nhật schema.prisma')
  console.log('   Xóa dòng: content  String')
  console.log('   Thêm dòng: contentUrl String?')
}

main()
  .catch(err => {
    console.error('💥 ERROR:', err.message)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
