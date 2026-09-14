-- Thêm cột mốc "Mới Cập Nhật" cho bảng Story (an toàn, cộng thêm, KHÔNG mất data).
-- Lý do: Story.updatedAt bị Prisma @updatedAt bump mỗi lần story.update() chạy —
-- kể cả khi chỉ tăng viewCount lúc user mở chương. Sắp xếp "Mới Cập Nhật" theo
-- updatedAt vì thế thực chất là "truyện vừa có người đọc", không phải "vừa có chương mới".
--
-- lastChapterAt = thời điểm truyện có chương mới nhất, fallback = lúc tạo truyện.
--
-- Chạy (local, đã nạp DATABASE_URL):
--   npx prisma db execute --file lastchapter-migration.sql --schema prisma/schema.prisma
-- Hoặc trên VPS:  psql "$DATABASE_URL" -f lastchapter-migration.sql
-- KHÔNG chạy `prisma migrate dev` (xem CLAUDE.md — DB đang drift).

-- 1) Thêm cột. Postgres 11+ : ADD COLUMN có DEFAULT là thao tác metadata, không rewrite bảng.
ALTER TABLE "Story"
  ADD COLUMN IF NOT EXISTS "lastChapterAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- 2) Backfill: lấy chương mới nhất của từng truyện; truyện chưa có chương thì dùng createdAt.
UPDATE "Story" s
SET "lastChapterAt" = COALESCE(
    (SELECT MAX(c."createdAt") FROM "Chapter" c WHERE c."storyId" = s."id"),
    s."createdAt"
);

-- 3) Index phục vụ ORDER BY lastChapterAt DESC kèm lọc isHidden.
CREATE INDEX IF NOT EXISTS "Story_isHidden_lastChapterAt_idx"
  ON "Story" ("isHidden", "lastChapterAt");
