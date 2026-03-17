/**
 * Migrate ảnh bìa từ public/uploads/ lên Cloudflare R2
 * Chạy: npx tsx prisma/migrate-covers-to-r2.ts
 */

import { PrismaClient } from '@prisma/client'
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const ACCOUNT_ID    = process.env.R2_ACCOUNT_ID!
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!
const SECRET_KEY    = process.env.R2_SECRET_ACCESS_KEY!
const BUCKET_NAME   = process.env.R2_BUCKET_NAME!
const PUBLIC_URL    = process.env.R2_PUBLIC_URL!

const prisma = new PrismaClient()

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: ACCESS_KEY_ID,
    secretAccessKey: SECRET_KEY,
  },
})

async function uploadToR2(key: string, filePath: string, contentType: string): Promise<void> {
  const fileBuffer = fs.readFileSync(filePath)
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: fileBuffer,
    ContentType: contentType,
  }))
}

async function existsOnR2(key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: key }))
    return true
  } catch {
    return false
  }
}

function getContentType(filename: string): string {
  const ext = path.extname(filename).toLowerCase()
  const map: Record<string, string> = {
    '.webp': 'image/webp',
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png':  'image/png',
    '.gif':  'image/gif',
  }
  return map[ext] || 'image/jpeg'
}

async function main() {
  console.log('🚀 Bắt đầu migrate ảnh bìa lên R2...')

  const stories = await prisma.story.findMany({
    select: { id: true, slug: true, coverImage: true }
  })

  console.log(`📊 Tổng truyện: ${stories.length}`)

  let success = 0, skipped = 0, errors = 0, notFound = 0

  for (const story of stories) {
    if (!story.coverImage) {
      skipped++
      continue
    }

    // Bỏ qua nếu đã là R2 URL
    if (story.coverImage.includes('r2.dev') || story.coverImage.startsWith('http')) {
      console.log(`⏭️  SKIP (already R2): ${story.slug}`)
      skipped++
      continue
    }

    // Lấy tên file từ URL: /uploads/filename.webp → filename.webp
    const filename = path.basename(story.coverImage)
    const localPath = path.join(process.cwd(), 'public', 'uploads', filename)

    if (!fs.existsSync(localPath)) {
      console.log(`❌ File not found: ${localPath}`)
      notFound++
      continue
    }

    // R2 key: covers/filename
    const r2Key = `covers/${filename}`
    const r2Url = `${PUBLIC_URL}/${r2Key}`

    try {
      const exists = await existsOnR2(r2Key)
      if (exists) {
        console.log(`⏭️  Already on R2: ${filename}`)
        // Vẫn update DB nếu URL chưa đúng
        await prisma.story.update({
          where: { id: story.id },
          data: { coverImage: r2Url }
        })
        skipped++
        continue
      }

      await uploadToR2(r2Key, localPath, getContentType(filename))
      await prisma.story.update({
        where: { id: story.id },
        data: { coverImage: r2Url }
      })

      console.log(`✅ ${story.slug} → ${r2Url}`)
      success++
    } catch (err: any) {
      console.error(`❌ ERROR: ${story.slug} — ${err.message}`)
      errors++
    }
  }

  console.log('\n' + '═'.repeat(50))
  console.log('🎉 Migrate ảnh bìa hoàn tất!')
  console.log(`   ✅ Success  : ${success}`)
  console.log(`   ⏭️  Skipped  : ${skipped}`)
  console.log(`   ❌ Errors   : ${errors}`)
  console.log(`   🔍 Not found: ${notFound}`)
  console.log('═'.repeat(50))
}

main()
  .catch(err => {
    console.error('💥 FATAL:', err.message)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
