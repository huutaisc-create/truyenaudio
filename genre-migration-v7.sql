-- ════════════════════════════════════════════════════════════════════════════
-- MIGRATION: remap thể loại 5 nhóm cũ → BẢNG CHUẨN MỚI 7 nhóm
--   THE_GIOI, LOAI_HINH, GIOI_TINH, THI_GIAC, BAN_TAY_VANG, NHAN_THIET, KET_THUC
-- - Đổi type + chuẩn hoá tên (Title Case) theo taxonomy.
-- - Tag NGOÀI chuẩn (không khớp) → XOÁ (theo yêu cầu "bỏ").
-- - Có backup: Genre_bak_v7 / _GenreToStory_bak_v7 (khôi phục được).
-- Chạy trên VPS:  psql "$DATABASE_URL" -f genre-migration-v7.sql
-- ════════════════════════════════════════════════════════════════════════════
\pset pager off
BEGIN;

CREATE EXTENSION IF NOT EXISTS unaccent;

-- 0) BACKUP (an toàn — có thể phục hồi)
DROP TABLE IF EXISTS "Genre_bak_v7";
CREATE TABLE "Genre_bak_v7" AS TABLE "Genre";
DROP TABLE IF EXISTS "_GenreToStory_bak_v7";
CREATE TABLE "_GenreToStory_bak_v7" AS TABLE "_GenreToStory";

-- 1) Hàm chuẩn hoá khoá so khớp (mirror normKey của taxonomy.ts)
CREATE OR REPLACE FUNCTION pg_temp.normkey(s text) RETURNS text AS $$
  SELECT trim(regexp_replace(
           lower(unaccent(translate($1, 'Đđ', 'Dd'))),
           '[^a-z0-9]+', ' ', 'g'));
$$ LANGUAGE sql IMMUTABLE;

-- 2) Bảng ánh xạ chuẩn: nkey → (canonical, newtype)
CREATE TEMP TABLE tax_map (nkey text PRIMARY KEY, canonical text, newtype text);
INSERT INTO tax_map (nkey, canonical, newtype) VALUES
  ('co dai', 'Cổ Đại', 'THE_GIOI'),
  ('nien dai', 'Niên Đại', 'THE_GIOI'),
  ('hien dai', 'Hiện Đại', 'THE_GIOI'),
  ('tuong lai', 'Tương Lai', 'THE_GIOI'),
  ('mat the', 'Mạt Thế', 'THE_GIOI'),
  ('tu tien', 'Tu Tiên', 'THE_GIOI'),
  ('dong nhan', 'Đồng Nhân', 'THE_GIOI'),
  ('vo hiep', 'Võ Hiệp', 'THE_GIOI'),
  ('thu the', 'Thú Thế', 'THE_GIOI'),
  ('xuyen nhanh', 'Xuyên Nhanh', 'THE_GIOI'),
  ('thi giac nam chu', 'Thị Giác Nam Chủ', 'THI_GIAC'),
  ('thi giac nu chu', 'Thị Giác Nữ Chủ', 'THI_GIAC'),
  ('chu cong', 'Chủ Công', 'THI_GIAC'),
  ('chu thu', 'Chủ Thụ', 'THI_GIAC'),
  ('ngon tinh', 'Ngôn Tình', 'GIOI_TINH'),
  ('nam sinh', 'Nam Sinh', 'GIOI_TINH'),
  ('dam my', 'Đam Mỹ', 'GIOI_TINH'),
  ('bach hop', 'Bách Hợp', 'GIOI_TINH'),
  ('nu ton', 'Nữ Tôn', 'GIOI_TINH'),
  ('khong cp', 'Không CP', 'GIOI_TINH'),
  ('da nguyen', 'Đa Nguyên', 'GIOI_TINH'),
  ('1v1', '1v1', 'GIOI_TINH'),
  ('np', 'NP', 'GIOI_TINH'),
  ('tinh cam', 'Tình Cảm', 'LOAI_HINH'),
  ('lam su nghiep', 'Làm Sự Nghiệp', 'LOAI_HINH'),
  ('sinh ton', 'Sinh Tồn', 'LOAI_HINH'),
  ('tranh ba', 'Tranh Bá', 'LOAI_HINH'),
  ('trinh tham', 'Trinh Thám', 'LOAI_HINH'),
  ('kinh di', 'Kinh Dị', 'LOAI_HINH'),
  ('quan truong', 'Quan Trường', 'LOAI_HINH'),
  ('quan su', 'Quân Sự', 'LOAI_HINH'),
  ('lam ruong', 'Làm Ruộng', 'LOAI_HINH'),
  ('cung dau', 'Cung Đấu', 'LOAI_HINH'),
  ('gia dau', 'Gia Đấu', 'LOAI_HINH'),
  ('ngot sung', 'Ngọt Sủng', 'LOAI_HINH'),
  ('nguoc van', 'Ngược Văn', 'LOAI_HINH'),
  ('cau huyet', 'Cẩu Huyết', 'LOAI_HINH'),
  ('chua lanh', 'Chữa Lành', 'LOAI_HINH'),
  ('tuy than khong gian', 'Tùy Thân Không Gian', 'BAN_TAY_VANG'),
  ('he thong', 'Hệ Thống', 'BAN_TAY_VANG'),
  ('doc tam', 'Đọc Tâm', 'BAN_TAY_VANG'),
  ('danh dau', 'Đánh Dấu', 'BAN_TAY_VANG'),
  ('xuyen khong', 'Xuyên Không', 'BAN_TAY_VANG'),
  ('xuyen thu', 'Xuyên Thư', 'BAN_TAY_VANG'),
  ('xuyen game', 'Xuyên Game', 'BAN_TAY_VANG'),
  ('trong sinh', 'Trọng Sinh', 'BAN_TAY_VANG'),
  ('nu cuong', 'Nữ Cường', 'NHAN_THIET'),
  ('tra nu', 'Tra Nữ', 'NHAN_THIET'),
  ('tra nam', 'Tra Nam', 'NHAN_THIET'),
  ('tra xanh', 'Trà Xanh', 'NHAN_THIET'),
  ('van nhan me', 'Vạn Nhân Mê', 'NHAN_THIET'),
  ('hai huoc', 'Hài Hước', 'NHAN_THIET'),
  ('mary sue', 'Mary Sue', 'NHAN_THIET'),
  ('he', 'HE', 'KET_THUC'),
  ('se', 'SE', 'KET_THUC'),
  ('oe', 'OE', 'KET_THUC'),
  ('nu chu', 'Thị Giác Nữ Chủ', 'THI_GIAC'),
  ('goc nhin nu chinh', 'Thị Giác Nữ Chủ', 'THI_GIAC'),
  ('nu chinh', 'Thị Giác Nữ Chủ', 'THI_GIAC'),
  ('nam chu', 'Thị Giác Nam Chủ', 'THI_GIAC'),
  ('goc nhin nam chinh', 'Thị Giác Nam Chủ', 'THI_GIAC'),
  ('nam chinh', 'Thị Giác Nam Chủ', 'THI_GIAC'),
  ('tien hiep', 'Tu Tiên', 'THE_GIOI'),
  ('tu chan', 'Tu Tiên', 'THE_GIOI'),
  ('sung', 'Ngọt Sủng', 'LOAI_HINH'),
  ('ngot', 'Ngọt Sủng', 'LOAI_HINH'),
  ('nguoc', 'Ngược Văn', 'LOAI_HINH'),
  ('tuy than', 'Tùy Thân Không Gian', 'BAN_TAY_VANG'),
  ('khong gian tuy than', 'Tùy Thân Không Gian', 'BAN_TAY_VANG'),
  ('mary sure', 'Mary Sue', 'NHAN_THIET'),
  ('marysue', 'Mary Sue', 'NHAN_THIET'),
  ('no cp', 'Không CP', 'GIOI_TINH'),
  ('vo cp', 'Không CP', 'GIOI_TINH'),
  ('happy ending', 'HE', 'KET_THUC'),
  ('ket he', 'HE', 'KET_THUC'),
  ('sad ending', 'SE', 'KET_THUC'),
  ('ket se', 'SE', 'KET_THUC'),
  ('open ending', 'OE', 'KET_THUC'),
  ('ket oe', 'OE', 'KET_THUC');

-- 3) Xác định đích cho mỗi Genre hiện có
CREATE TEMP TABLE g_target AS
SELECT g.id, g.name AS oldname, g.type AS oldtype, m.canonical, m.newtype
FROM "Genre" g
LEFT JOIN tax_map m ON m.nkey = pg_temp.normkey(g.name);

-- 4) Tạo row canonical còn thiếu (đúng name + newtype)
INSERT INTO "Genre" (id, name, type)
SELECT md5(random()::text || clock_timestamp()::text || t.canonical), t.canonical, t.newtype
FROM (SELECT DISTINCT canonical, newtype FROM g_target WHERE canonical IS NOT NULL) t
WHERE NOT EXISTS (
  SELECT 1 FROM "Genre" g2 WHERE g2.name = t.canonical AND g2.type = t.newtype
);

-- 5) Bản đồ old_id → survivor_id (row canonical đúng chuẩn)
CREATE TEMP TABLE id_map AS
SELECT gt.id AS old_id, surv.id AS new_id
FROM g_target gt
JOIN "Genre" surv ON surv.name = gt.canonical AND surv.type = gt.newtype
WHERE gt.canonical IS NOT NULL;

-- 6) Dời liên kết truyện từ row cũ → survivor (tránh trùng)
UPDATE "_GenreToStory" gs
SET "A" = im.new_id
FROM id_map im
WHERE gs."A" = im.old_id
  AND im.old_id <> im.new_id
  AND NOT EXISTS (SELECT 1 FROM "_GenreToStory" x WHERE x."A" = im.new_id AND x."B" = gs."B");

-- 7) Xoá liên kết trùng còn sót ở row cũ, rồi xoá row cũ (không phải survivor)
DELETE FROM "_GenreToStory" gs USING id_map im
WHERE gs."A" = im.old_id AND im.old_id <> im.new_id;

DELETE FROM "Genre" g USING id_map im
WHERE g.id = im.old_id AND im.old_id <> im.new_id;

-- 8) Xoá tag NGOÀI chuẩn (không khớp taxonomy) + liên kết của chúng
DELETE FROM "_GenreToStory" gs USING g_target gt
WHERE gs."A" = gt.id AND gt.canonical IS NULL;

DELETE FROM "Genre" g USING g_target gt
WHERE g.id = gt.id AND gt.canonical IS NULL;

-- 9) BÁO CÁO
\echo '── Số tag theo nhóm sau migration ──'
SELECT type, COUNT(*) AS so_tag FROM "Genre" GROUP BY type ORDER BY type;

\echo '── Tổng số Genre ──'
SELECT COUNT(*) AS tong_genre FROM "Genre";

COMMIT;

-- Khôi phục nếu cần (chạy tay khi CHƯA commit hoặc từ backup):
--   TRUNCATE "_GenreToStory"; INSERT INTO "_GenreToStory" SELECT * FROM "_GenreToStory_bak_v7";
--   TRUNCATE "Genre" CASCADE; INSERT INTO "Genre" SELECT * FROM "Genre_bak_v7";
