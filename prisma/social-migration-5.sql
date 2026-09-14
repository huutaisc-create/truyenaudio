-- prisma/social-migration-5.sql
-- Thông báo TRUYỆN MỚI + TRUYỆN CẬP NHẬT (chương mới), có hàng đợi chống spam.
--
-- CHẠY TRỰC TIẾP trên DB (KHÔNG dùng `prisma migrate dev`). Idempotent — chạy lại an toàn.
--   Prod (VPS):  psql "$DATABASE_URL" -f prisma/social-migration-5.sql
-- Sau đó: `npx prisma generate` (KHÔNG migrate).
--
-- ⚠ KHÔNG bọc file này trong BEGIN/COMMIT như migration-4:
--   `ALTER TYPE ... ADD VALUE` không chạy được bên trong transaction block ở nhiều
--   bản Postgres, và giá trị enum vừa thêm cũng không dùng được ngay trong cùng
--   transaction. Để từng câu tự autocommit là cách chắc ăn nhất.

-- 1) Hai loại thông báo mới.
--    Lần này BUỘC phải thêm giá trị enum (khác với bài đăng kênh — chỗ đó phân biệt
--    được bằng cột postId có/không). Truyện mới và truyện cập nhật đều chỉ có storyId,
--    không có gì để suy ra loại, mà câu chữ hiển thị lại khác hẳn nhau.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'NEW_STORY';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'STORY_UPDATE';

-- 2) Hàng đợi thông báo truyện.
--
-- VÌ SAO CẦN HÀNG ĐỢI: script import đổ chương theo lô, một truyện có thể nhận hàng
-- chục lần gọi API trong vài phút. Bắn push ngay tại chỗ = hàng chục lần rung máy cho
-- cùng một truyện. Ở đây chỉ GHI NHẬN "truyện này đang nợ thông báo, cộng dồn N chương",
-- rồi cron 5 phút (/api/cron/notify-push) mới gom lại bắn 1 lần.
--
--   kind = 'NEW'    → truyện mới thêm vào hệ thống. pendingCount chỉ là cờ 0/1.
--   kind = 'UPDATE' → có chương mới. pendingCount = TỔNG số chương mới chưa báo.
--
-- Cửa chặn 30 phút:
--   UPDATE: theo TỪNG truyện — lastSentAt của chính dòng đó.
--   NEW:    TOÀN CỤC — max(lastSentAt) của mọi dòng kind='NEW'. Nhiều truyện mới cùng
--           lúc thì xếp hàng, cứ 30 phút gọi tên một truyện (theo yêu cầu).
CREATE TABLE IF NOT EXISTS "StoryAnnounceQueue" (
  "id"           TEXT PRIMARY KEY,
  "storyId"      TEXT NOT NULL REFERENCES "Story"("id") ON DELETE CASCADE,
  "kind"         TEXT NOT NULL,                        -- 'NEW' | 'UPDATE'
  "pendingCount" INTEGER NOT NULL DEFAULT 0,           -- UPDATE: số chương cộng dồn; NEW: 0/1
  "pendingSince" TIMESTAMP(3),                         -- lúc bắt đầu nợ (NULL = không nợ gì)
  "lastSentAt"   TIMESTAMP(3),                         -- lần báo gần nhất → cửa chặn 30 phút
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT now()
);

-- Mỗi truyện chỉ 1 dòng cho mỗi loại → upsert bằng ON CONFLICT được.
CREATE UNIQUE INDEX IF NOT EXISTS "StoryAnnounceQueue_storyId_kind_key"
  ON "StoryAnnounceQueue" ("storyId", "kind");

-- Cron quét theo "đang nợ, cũ nhất trước".
CREATE INDEX IF NOT EXISTS "StoryAnnounceQueue_kind_pendingSince_idx"
  ON "StoryAnnounceQueue" ("kind", "pendingSince");

-- 3) Thông báo truyện không có "người gây ra" (actor) như like/reply — cột actorId
--    vốn đã nullable nên không phải sửa gì. actorCount được DÙNG LẠI làm SỐ CHƯƠNG MỚI
--    cho STORY_UPDATE (xem src/lib/storyAnnounce.ts) để khỏi thêm cột mới.
