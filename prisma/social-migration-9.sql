-- prisma/social-migration-9.sql
-- Cho phép cột Story.author để trống (NULL) — lúc tạo truyện trong admin
-- không bắt buộc điền Tác Giả nữa, và cột này cũng đã bị ẩn khỏi bảng
-- quản lý trong /admin/stories.
--
-- CHẠY TRỰC TIẾP trên DB (KHÔNG dùng `prisma migrate dev`). Idempotent
-- (DROP NOT NULL không lỗi nếu cột đã nullable sẵn).
--   Prod (VPS):  psql "$DATABASE_URL" -f prisma/social-migration-9.sql
-- Sau đó: `npx prisma generate` (KHÔNG migrate).

ALTER TABLE "Story" ALTER COLUMN "author" DROP NOT NULL;
