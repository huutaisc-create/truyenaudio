-- ============================================================
-- migrate_neon.sql
-- Thêm các cột tracking upload vào bảng stories (Neon PostgreSQL)
-- Chạy 1 lần trong Neon SQL Editor hoặc qua psql
-- Tất cả lệnh đều idempotent (IF NOT EXISTS / DEFAULT NULL)
-- ============================================================

-- Trạng thái upload lên web:
--   NULL       = chưa xử lý
--   'uploading' = đang upload (dùng nếu cần multi-process lock)
--   'done'     = đã upload thành công
--   'error'    = upload thất bại (xem log để biết lý do)
ALTER TABLE stories ADD COLUMN IF NOT EXISTS web_upload_status     VARCHAR(30)   DEFAULT NULL;

-- Thời điểm upload gần nhất
ALTER TABLE stories ADD COLUMN IF NOT EXISTS web_upload_at         TIMESTAMPTZ   DEFAULT NULL;

-- Số chương đã được upload thành công
ALTER TABLE stories ADD COLUMN IF NOT EXISTS web_uploaded_chapters INTEGER       DEFAULT 0;

-- Index để query nhanh theo trạng thái
CREATE INDEX IF NOT EXISTS idx_stories_web_upload_status ON stories(web_upload_status);

-- ── Kiểm tra kết quả ─────────────────────────────────────────
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'stories' AND column_name LIKE 'web_%';

-- ── Query thống kê upload ─────────────────────────────────────
-- SELECT
--   web_upload_status,
--   COUNT(*) AS count
-- FROM stories
-- GROUP BY web_upload_status
-- ORDER BY count DESC;

-- ── Reset để upload lại tất cả (nếu cần) ─────────────────────
-- UPDATE stories SET web_upload_status = NULL, web_upload_at = NULL, web_uploaded_chapters = 0;

-- ── Reset chỉ các truyện lỗi ─────────────────────────────────
-- UPDATE stories SET web_upload_status = NULL WHERE web_upload_status = 'error';
