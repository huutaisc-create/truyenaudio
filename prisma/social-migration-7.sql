-- prisma/social-migration-7.sql
-- Báo cáo nội dung (Report) + Chặn người dùng (UserBlock).
-- Yêu cầu bắt buộc của chính sách User Generated Content — Google Play, cho app
-- có bình luận truyện (Comment), bài đăng kênh (ChannelPost/ChannelPostComment).
--
-- CHẠY TRỰC TIẾP trên DB (KHÔNG dùng `prisma migrate dev`). Idempotent — chạy lại an toàn.
--   Prod (VPS):  psql "$DATABASE_URL" -f prisma/social-migration-7.sql
-- Sau đó: `npx prisma generate` (KHÔNG migrate).

BEGIN;

-- 1) Báo cáo nội dung / người dùng
CREATE TABLE IF NOT EXISTS "Report" (
  "id"           TEXT PRIMARY KEY,
  "reporterId"   TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "targetType"   TEXT NOT NULL,
  "targetId"     TEXT NOT NULL,
  "targetUserId" TEXT,
  "reason"       TEXT NOT NULL,
  "note"         TEXT,
  "status"       TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT now(),
  "reviewedAt"   TIMESTAMP(3),
  "reviewedBy"   TEXT,
  CONSTRAINT "Report_reporterId_targetType_targetId_key" UNIQUE ("reporterId", "targetType", "targetId")
);
CREATE INDEX IF NOT EXISTS "Report_status_createdAt_idx" ON "Report" ("status", "createdAt");
CREATE INDEX IF NOT EXISTS "Report_targetType_targetId_idx" ON "Report" ("targetType", "targetId");

-- 2) Chặn người dùng — một chiều (A chặn B không có nghĩa B chặn A)
CREATE TABLE IF NOT EXISTS "UserBlock" (
  "id"        TEXT PRIMARY KEY,
  "blockerId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "blockedId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  CONSTRAINT "UserBlock_blockerId_blockedId_key" UNIQUE ("blockerId", "blockedId")
);
CREATE INDEX IF NOT EXISTS "UserBlock_blockedId_idx" ON "UserBlock" ("blockedId");

COMMIT;
