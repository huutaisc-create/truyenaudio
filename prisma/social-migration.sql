-- prisma/social-migration.sql
-- Social feature (Comment reply/like/soft-delete + Chat phòng "tám chuyện" + Notification tương tác)
-- CHẠY TRỰC TIẾP trên DB (KHÔNG dùng `prisma migrate dev`). Idempotent — chạy lại an toàn.
--   Dev (Neon):  psql "$DATABASE_URL_DEV" -f prisma/social-migration.sql
--   Prod (VPS):  psql "$DATABASE_URL"     -f prisma/social-migration.sql
-- Sau đó: cập nhật schema.prisma (đã làm) rồi `npx prisma generate` (KHÔNG migrate).

BEGIN;

-- gen_random_uuid() cho phần seed
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) ENUMS
DO $$ BEGIN CREATE TYPE "CommentStatus" AS ENUM ('VISIBLE','DELETED','HIDDEN');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "ChatRoomType" AS ENUM ('PUBLIC','DIRECT','GROUP');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "ChatMessageStatus" AS ENUM ('VISIBLE','DELETED','HIDDEN');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "NotificationType" AS ENUM ('COMMENT_REPLY','COMMENT_LIKE','CHAT_MENTION');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2) MỞ RỘNG Comment (bảng đã có)
ALTER TABLE "Comment"
  ADD COLUMN IF NOT EXISTS "parentId"   TEXT,
  ADD COLUMN IF NOT EXISTS "replyCount" INTEGER         NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "status"     "CommentStatus" NOT NULL DEFAULT 'VISIBLE',
  ADD COLUMN IF NOT EXISTS "updatedAt"  TIMESTAMP(3)    NOT NULL DEFAULT now();

DO $$ BEGIN
  ALTER TABLE "Comment"
    ADD CONSTRAINT "Comment_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS "Comment_storyId_parentId_createdAt_idx" ON "Comment" ("storyId","parentId","createdAt");
CREATE INDEX IF NOT EXISTS "Comment_parentId_createdAt_idx"          ON "Comment" ("parentId","createdAt");
-- (index cũ "Comment_storyId_createdAt_idx" giữ nguyên)

-- 3) ChatRoom
CREATE TABLE IF NOT EXISTS "ChatRoom" (
  "id"        TEXT PRIMARY KEY,
  "slug"      TEXT NOT NULL UNIQUE,
  "name"      TEXT NOT NULL,
  "type"      "ChatRoomType" NOT NULL DEFAULT 'PUBLIC',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);

-- 4) RoomMessage (phòng chung; KHÁC ChatMessage-theo-storySlug đã có)
CREATE TABLE IF NOT EXISTS "RoomMessage" (
  "id"        TEXT PRIMARY KEY,
  "roomId"    TEXT NOT NULL REFERENCES "ChatRoom"("id") ON DELETE CASCADE,
  "userId"    TEXT NOT NULL REFERENCES "User"("id")     ON DELETE CASCADE,
  "content"   TEXT NOT NULL,
  "status"    "ChatMessageStatus" NOT NULL DEFAULT 'VISIBLE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "RoomMessage_roomId_createdAt_idx" ON "RoomMessage" ("roomId","createdAt");
CREATE INDEX IF NOT EXISTS "RoomMessage_userId_idx"           ON "RoomMessage" ("userId");

-- 5) ChatRoomRead (mốc đã đọc → badge unread)
CREATE TABLE IF NOT EXISTS "ChatRoomRead" (
  "roomId"     TEXT NOT NULL REFERENCES "ChatRoom"("id") ON DELETE CASCADE,
  "userId"     TEXT NOT NULL REFERENCES "User"("id")     ON DELETE CASCADE,
  "lastReadAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("roomId","userId")
);

-- 6) Notification (tương tác — KHÁC PushNotification admin)
CREATE TABLE IF NOT EXISTS "Notification" (
  "id"           TEXT PRIMARY KEY,
  "recipientId"  TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "type"         "NotificationType" NOT NULL,
  "storyId"      TEXT,
  "commentId"    TEXT,
  "roomId"       TEXT,
  "messageId"    TEXT,
  "groupKey"     TEXT NOT NULL,
  "actorId"      TEXT,
  "actorCount"   INTEGER NOT NULL DEFAULT 1,
  "isRead"       BOOLEAN NOT NULL DEFAULT false,
  "lastPushedAt" TIMESTAMP(3),
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "Notification_recipientId_isRead_updatedAt_idx"
  ON "Notification" ("recipientId","isRead","updatedAt");
-- gộp: mỗi (người nhận + nhóm) chỉ 1 dòng CHƯA ĐỌC
CREATE UNIQUE INDEX IF NOT EXISTS "Notification_unread_group_uq"
  ON "Notification" ("recipientId","groupKey") WHERE "isRead" = false;
-- cron quét (partial, phần chưa đọc)
CREATE INDEX IF NOT EXISTS "Notification_unread_idx"
  ON "Notification" ("updatedAt") WHERE "isRead" = false;

-- 7) Seed phòng "tám chuyện"
INSERT INTO "ChatRoom" ("id","slug","name","type")
VALUES (gen_random_uuid(), 'tam-chuyen', 'Tám Chuyện', 'PUBLIC')
ON CONFLICT ("slug") DO NOTHING;

COMMIT;

-- Kiểm tra nhanh sau khi chạy:
--   SELECT column_name FROM information_schema.columns WHERE table_name='Comment' AND column_name IN ('parentId','replyCount','status','updatedAt');
--   SELECT slug,name FROM "ChatRoom";
--   \d "Notification"
