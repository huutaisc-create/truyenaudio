-- prisma/social-migration-3.sql
-- Thêm rootCommentId vào Notification (để deep-link mở đúng thread + cuộn tới reply).
-- Chạy: psql "$DATABASE_URL" -f prisma/social-migration-3.sql   (idempotent)

ALTER TABLE "Notification"
  ADD COLUMN IF NOT EXISTS "rootCommentId" TEXT;
