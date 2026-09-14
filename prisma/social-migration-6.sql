-- prisma/social-migration-6.sql
-- Index phục vụ việc DỌN THÔNG BÁO CŨ (/api/cron/cleanup, chạy 1 lần/ngày).
--
-- CHẠY TRỰC TIẾP trên DB (KHÔNG dùng `prisma migrate dev`). Idempotent.
--   Prod (VPS):  psql "$DATABASE_URL" -f prisma/social-migration-6.sql
-- Sau đó: `npx prisma generate` (KHÔNG migrate).
--
-- Không có index này thì mỗi lô xoá phải quét toàn bộ bảng Notification để tìm
-- dòng quá hạn — càng dọn lâu càng chậm, đúng lúc bảng to nhất.
--
-- Index theo createdAt (KHÔNG phải updatedAt): updatedAt bị đẩy lên mỗi lần thông
-- báo được gộp thêm người, dùng nó thì dòng nào liên tục có tương tác sẽ không bao
-- giờ tới hạn dọn.
CREATE INDEX IF NOT EXISTS "Notification_createdAt_idx"
  ON "Notification" ("createdAt");
