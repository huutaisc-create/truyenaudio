-- Thêm index cho bảng Story (an toàn, cộng thêm, không mất data).
-- Chạy: npx prisma db execute --file indexes.sql --schema prisma/schema.prisma
CREATE INDEX IF NOT EXISTS "Story_isHidden_updatedAt_idx"       ON "Story" ("isHidden", "updatedAt");
CREATE INDEX IF NOT EXISTS "Story_isHidden_viewCount_idx"       ON "Story" ("isHidden", "viewCount");
CREATE INDEX IF NOT EXISTS "Story_isHidden_ratingCount_idx"     ON "Story" ("isHidden", "ratingCount");
CREATE INDEX IF NOT EXISTS "Story_isHidden_createdAt_idx"       ON "Story" ("isHidden", "createdAt");
CREATE INDEX IF NOT EXISTS "Story_isFeatured_featuredOrder_idx" ON "Story" ("isFeatured", "featuredOrder");
