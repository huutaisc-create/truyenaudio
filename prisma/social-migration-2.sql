-- prisma/social-migration-2.sql
-- Thêm storySlug + preview vào Notification (deep-link + trích đoạn nội dung).
-- Chạy: psql "$DATABASE_URL" -f prisma/social-migration-2.sql   (idempotent)

ALTER TABLE "Notification"
  ADD COLUMN IF NOT EXISTS "storySlug" TEXT,
  ADD COLUMN IF NOT EXISTS "preview"   TEXT;
