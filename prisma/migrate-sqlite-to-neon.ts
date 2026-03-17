/**
 * Migrate toàn bộ data từ SQLite → Neon Postgres
 * 
 * Chạy: npx tsx prisma/migrate-sqlite-to-neon.ts
 * 
 * Thứ tự: User → Genre → Story → Chapter → (relations)
 */

import { PrismaClient as SQLiteClient } from '@prisma/client'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'
import Database from 'better-sqlite3'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })

// ── Neon client (từ DATABASE_URL trong .env) ─────────────
const neon = new SQLiteClient()

// ── SQLite direct connection ──────────────────────────────
const sqlitePath = path.join(process.cwd(), 'prisma', 'dev.db')
const sqlite = new Database(sqlitePath, { readonly: true })

const LOG_FILE = path.join(process.cwd(), 'prisma', 'migrate-sqlite-to-neon.log')
function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}`
  console.log(line)
  fs.appendFileSync(LOG_FILE, line + '\n')
}

const BATCH = 500 // insert 500 rows mỗi lần

async function migrateTable<T extends Record<string, any>>(
  tableName: string,
  rows: T[],
  insertFn: (batch: T[]) => Promise<void>
) {
  if (rows.length === 0) {
    log(`⏭️  ${tableName}: trống, bỏ qua`)
    return
  }
  log(`📦 ${tableName}: ${rows.length} rows`)
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    await insertFn(batch)
    log(`   ✅ ${Math.min(i + BATCH, rows.length)}/${rows.length}`)
  }
  log(`✅ ${tableName} xong!`)
}

async function main() {
  log('🚀 Bắt đầu migrate SQLite → Neon')

  // ── 1. User ──────────────────────────────────────────────
  const users = sqlite.prepare('SELECT * FROM User').all() as any[]
  await migrateTable('User', users, async (batch) => {
    await neon.$executeRawUnsafe(`
      INSERT INTO "User" (id, email, name, image, password, "googleId", role, "chaptersRead", "createdAt", "updatedAt")
      VALUES ${batch.map((_, i) => `($${i*10+1},$${i*10+2},$${i*10+3},$${i*10+4},$${i*10+5},$${i*10+6},$${i*10+7},$${i*10+8},$${i*10+9},$${i*10+10})`).join(',')}
      ON CONFLICT (id) DO NOTHING
    `, ...batch.flatMap(r => [r.id, r.email, r.name, r.image, r.password, r.googleId, r.role, r.chaptersRead, new Date(r.createdAt), new Date(r.updatedAt)]))
  })

  // ── 2. Genre ─────────────────────────────────────────────
  const genres = sqlite.prepare('SELECT * FROM Genre').all() as any[]
  await migrateTable('Genre', genres, async (batch) => {
    await neon.$executeRawUnsafe(`
      INSERT INTO "Genre" (id, name, type, description)
      VALUES ${batch.map((_, i) => `($${i*4+1},$${i*4+2},$${i*4+3},$${i*4+4})`).join(',')}
      ON CONFLICT (id) DO NOTHING
    `, ...batch.flatMap(r => [r.id, r.name, r.type, r.description]))
  })

  // ── 3. Story ─────────────────────────────────────────────
  const stories = sqlite.prepare('SELECT * FROM Story').all() as any[]
  await migrateTable('Story', stories, async (batch) => {
    await neon.$executeRawUnsafe(`
      INSERT INTO "Story" (id, slug, title, author, description, "coverImage", status, "totalChapters", "viewCount", "ratingScore", "ratingCount", "followCount", "likeCount", "nominationCount", "createdAt", "updatedAt")
      VALUES ${batch.map((_, i) => `($${i*16+1},$${i*16+2},$${i*16+3},$${i*16+4},$${i*16+5},$${i*16+6},$${i*16+7},$${i*16+8},$${i*16+9},$${i*16+10},$${i*16+11},$${i*16+12},$${i*16+13},$${i*16+14},$${i*16+15},$${i*16+16})`).join(',')}
      ON CONFLICT (id) DO NOTHING
    `, ...batch.flatMap(r => [r.id, r.slug, r.title, r.author, r.description, r.coverImage, r.status, r.totalChapters, r.viewCount, r.ratingScore, r.ratingCount, r.followCount, r.likeCount, r.nominationCount, new Date(r.createdAt), new Date(r.updatedAt)]))
  })

  // ── 4. Story ↔ Genre (many-to-many) ─────────────────────
  const storyGenres = sqlite.prepare('SELECT * FROM "_GenreToStory"').all() as any[]
  await migrateTable('_GenreToStory', storyGenres, async (batch) => {
    await neon.$executeRawUnsafe(`
      INSERT INTO "_GenreToStory" ("A", "B")
      VALUES ${batch.map((_, i) => `($${i*2+1},$${i*2+2})`).join(',')}
      ON CONFLICT DO NOTHING
    `, ...batch.flatMap((r: any) => [r.A, r.B]))
  })

  // ── 5. Chapter ───────────────────────────────────────────
  log('\n📚 Chapter: đây là bảng lớn nhất, sẽ mất vài phút...')
  const totalChapters = (sqlite.prepare('SELECT COUNT(*) as cnt FROM Chapter').get() as any).cnt
  log(`   Tổng: ${totalChapters} chapters`)

  let offset = 0
  let chapterCount = 0
  while (true) {
    const batch = sqlite.prepare(`SELECT * FROM Chapter LIMIT ${BATCH} OFFSET ${offset}`).all() as any[]
    if (batch.length === 0) break

    await neon.$executeRawUnsafe(`
      INSERT INTO "Chapter" (id, "index", title, "contentUrl", "viewCount", "createdAt", "updatedAt", "storyId")
      VALUES ${batch.map((_, i) => `($${i*8+1},$${i*8+2},$${i*8+3},$${i*8+4},$${i*8+5},$${i*8+6},$${i*8+7},$${i*8+8})`).join(',')}
      ON CONFLICT (id) DO NOTHING
    `, ...batch.flatMap(r => [r.id, r.index, r.title, r.contentUrl, r.viewCount, new Date(r.createdAt), new Date(r.updatedAt), r.storyId]))

    chapterCount += batch.length
    offset += BATCH
    const pct = Math.round((chapterCount / totalChapters) * 100)
    log(`   ✅ ${chapterCount}/${totalChapters} (${pct}%)`)
  }
  log('✅ Chapter xong!')

  // ── 6. ReadingHistory ────────────────────────────────────
  const histories = sqlite.prepare('SELECT * FROM ReadingHistory').all() as any[]
  await migrateTable('ReadingHistory', histories, async (batch) => {
    await neon.$executeRawUnsafe(`
      INSERT INTO "ReadingHistory" (id, "visitedAt", "userId", "storyId", "chapterId")
      VALUES ${batch.map((_, i) => `($${i*5+1},$${i*5+2},$${i*5+3},$${i*5+4},$${i*5+5})`).join(',')}
      ON CONFLICT (id) DO NOTHING
    `, ...batch.flatMap(r => [r.id, new Date(r.visitedAt), r.userId, r.storyId, r.chapterId]))
  })

  // ── 7. Library ───────────────────────────────────────────
  const libraries = sqlite.prepare('SELECT * FROM Library').all() as any[]
  await migrateTable('Library', libraries, async (batch) => {
    await neon.$executeRawUnsafe(`
      INSERT INTO "Library" (id, "addedAt", "userId", "storyId")
      VALUES ${batch.map((_, i) => `($${i*4+1},$${i*4+2},$${i*4+3},$${i*4+4})`).join(',')}
      ON CONFLICT (id) DO NOTHING
    `, ...batch.flatMap(r => [r.id, new Date(r.addedAt), r.userId, r.storyId]))
  })

  // ── 8. Nomination ────────────────────────────────────────
  const nominations = sqlite.prepare('SELECT * FROM Nomination').all() as any[]
  await migrateTable('Nomination', nominations, async (batch) => {
    await neon.$executeRawUnsafe(`
      INSERT INTO "Nomination" (id, "createdAt", "userId", "storyId")
      VALUES ${batch.map((_, i) => `($${i*4+1},$${i*4+2},$${i*4+3},$${i*4+4})`).join(',')}
      ON CONFLICT (id) DO NOTHING
    `, ...batch.flatMap(r => [r.id, new Date(r.createdAt), r.userId, r.storyId]))
  })

  // ── 9. Like ──────────────────────────────────────────────
  const likes = sqlite.prepare('SELECT * FROM "Like"').all() as any[]
  await migrateTable('Like', likes, async (batch) => {
    await neon.$executeRawUnsafe(`
      INSERT INTO "Like" (id, "createdAt", "userId", "storyId")
      VALUES ${batch.map((_, i) => `($${i*4+1},$${i*4+2},$${i*4+3},$${i*4+4})`).join(',')}
      ON CONFLICT (id) DO NOTHING
    `, ...batch.flatMap(r => [r.id, new Date(r.createdAt), r.userId, r.storyId]))
  })

  // ── 10. Review ───────────────────────────────────────────
  const reviews = sqlite.prepare('SELECT * FROM Review').all() as any[]
  await migrateTable('Review', reviews, async (batch) => {
    await neon.$executeRawUnsafe(`
      INSERT INTO "Review" (id, rating, content, "createdAt", "userId", "storyId")
      VALUES ${batch.map((_, i) => `($${i*6+1},$${i*6+2},$${i*6+3},$${i*6+4},$${i*6+5},$${i*6+6})`).join(',')}
      ON CONFLICT (id) DO NOTHING
    `, ...batch.flatMap(r => [r.id, r.rating, r.content, new Date(r.createdAt), r.userId, r.storyId]))
  })

  // ── 11. Comment ──────────────────────────────────────────
  const comments = sqlite.prepare('SELECT * FROM Comment').all() as any[]
  await migrateTable('Comment', comments, async (batch) => {
    await neon.$executeRawUnsafe(`
      INSERT INTO "Comment" (id, content, "createdAt", "userId", "storyId")
      VALUES ${batch.map((_, i) => `($${i*5+1},$${i*5+2},$${i*5+3},$${i*5+4},$${i*5+5})`).join(',')}
      ON CONFLICT (id) DO NOTHING
    `, ...batch.flatMap(r => [r.id, r.content, new Date(r.createdAt), r.userId, r.storyId]))
  })

  // ── 12. ChatMessage ──────────────────────────────────────
  const chatMessages = sqlite.prepare('SELECT * FROM ChatMessage').all() as any[]
  await migrateTable('ChatMessage', chatMessages, async (batch) => {
    await neon.$executeRawUnsafe(`
      INSERT INTO "ChatMessage" (id, "storySlug", content, "likeCount", "createdAt", "userId")
      VALUES ${batch.map((_, i) => `($${i*6+1},$${i*6+2},$${i*6+3},$${i*6+4},$${i*6+5},$${i*6+6})`).join(',')}
      ON CONFLICT (id) DO NOTHING
    `, ...batch.flatMap(r => [r.id, r.storySlug, r.content, r.likeCount, new Date(r.createdAt), r.userId]))
  })

  log('\n' + '═'.repeat(60))
  log('🎉 Migrate toàn bộ data lên Neon thành công!')
  log('═'.repeat(60))
}

main()
  .catch(err => {
    log(`\n💥 FATAL: ${err.message}`)
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await neon.$disconnect()
    sqlite.close()
  })
