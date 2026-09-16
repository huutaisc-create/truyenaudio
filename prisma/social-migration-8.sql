-- prisma/social-migration-8.sql
-- Thêm cột Story.isAdult — đánh dấu thủ công truyện có nội dung 18+/gợi dục để
-- app che bìa (blur) + bắt xác nhận tuổi trước khi mở, theo chính sách UGC của
-- Google Play. Mặc định false cho toàn bộ truyện cũ, admin tự bật cho truyện
-- cần che bằng:
--   UPDATE "Story" SET "isAdult" = true WHERE slug IN ('slug-1', 'slug-2');
--
-- CHẠY TRỰC TIẾP trên DB (KHÔNG dùng `prisma migrate dev`). Idempotent.
--   Prod (VPS):  psql "$DATABASE_URL" -f prisma/social-migration-8.sql
-- Sau đó: `npx prisma generate` (KHÔNG migrate).

ALTER TABLE "Story" ADD COLUMN IF NOT EXISTS "isAdult" BOOLEAN NOT NULL DEFAULT false;

-- Cột User.ageConfirmed — user đã xác nhận đủ 18 tuổi để xem nội dung isAdult,
-- đồng bộ qua tài khoản (khác máy khỏi hỏi lại). Khách vãng lai lưu local trên máy.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "ageConfirmed" BOOLEAN NOT NULL DEFAULT false;
