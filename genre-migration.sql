-- ============================================================================
-- MIGRATION DỌN DỮ LIỆU THỂ LOẠI / TAG  (Phase 2)
-- Chạy SAU KHI đã deploy Phase 1 (form + action lưu đúng type).
-- Chạy trên VPS:  psql "$DBURL" -f genre-migration.sql
-- (DBURL=$(grep '^DATABASE_URL=' .env.local | cut -d= -f2- | tr -d '"'))
--
-- Nội dung: (1) backup → (2) xoá tag mồ côi (0 truyện) → (3) đổi type tag lệch
-- theo taxonomy đã chốt → (4) đối chiếu. Bọc trong transaction để an toàn.
-- ============================================================================

BEGIN;

-- (1) BACKUP (khôi phục: INSERT lại từ *_bak nếu cần)
DROP TABLE IF EXISTS "Genre_bak";
DROP TABLE IF EXISTS "_GenreToStory_bak";
CREATE TABLE "Genre_bak"          AS SELECT * FROM "Genre";
CREATE TABLE "_GenreToStory_bak"  AS SELECT * FROM "_GenreToStory";

-- (2) Xử lý va chạm unique(name,type): xoá TRƯỚC các dòng mồ côi (0 truyện) mà
--     TRÙNG ĐÍCH sắp đổi tới (vd BOI_CANH "Cổ Đại" rỗng đang chắn chỗ). CHỈ xoá
--     dòng 0 truyện & trùng đích — KHÔNG đụng tag hợp lệ khác.
DELETE FROM "Genre" g
WHERE NOT EXISTS (SELECT 1 FROM "_GenreToStory" s WHERE s."A" = g.id)
  AND (
    (g.type='BOI_CANH'  AND g.name IN ('Cổ Đại','Hiện Đại','Tương Lai','Dị Giới','Tây Phương','Huyền Ảo'))
 OR (g.type='LUU_PHAI'  AND g.name IN ('Hệ Thống','Tùy Thân','Xuyên Qua'))
 OR (g.type='TINH_CACH' AND g.name = 'Cơ Trí')
 OR (g.type='THI_GIAC'  AND g.name IN ('Thị giác nữ chủ','Thị giác nam chủ'))
  );

-- (3) ĐỔI TYPE các tag đang là GENRE nhưng thuộc facet khác (theo taxonomy).
--     Chỉ đổi type → giữ nguyên liên kết truyện, không mất dữ liệu.

-- → Bối cảnh
UPDATE "Genre" SET type = 'BOI_CANH'
WHERE type = 'GENRE'
  AND name IN ('Cổ Đại','Hiện Đại','Tương Lai','Dị Giới','Tây Phương','Huyền Ảo');

-- → Lưu phái  (Xuyên Không/Xuyên Nhanh/Trọng Sinh GIỮ ở Thể loại theo quyết định)
UPDATE "Genre" SET type = 'LUU_PHAI'
WHERE type = 'GENRE'
  AND name IN ('Hệ Thống','Tùy Thân','Xuyên Qua');

-- → Tính cách
UPDATE "Genre" SET type = 'TINH_CACH'
WHERE type = 'GENRE' AND name = 'Cơ Trí';

-- → Thị giác (đổi type + đổi tên cho khớp taxonomy)
UPDATE "Genre" SET type = 'THI_GIAC', name = 'Thị giác nữ chủ'
WHERE type = 'GENRE' AND name = 'Nữ Chủ';
UPDATE "Genre" SET type = 'THI_GIAC', name = 'Thị giác nam chủ'
WHERE type = 'GENRE' AND name = 'Nam Chủ';

-- (3b) XOÁ tag mồ côi đã duyệt bỏ (Nhóm 2 sai/rác + Nhóm 3 bỏ hẳn).
--      Guard NOT EXISTS: chỉ xoá dòng KHÔNG truyện nào dùng — an toàn tuyệt đối.
--      Tag hợp lệ chưa dùng (Nhóm 1: Đam Mỹ, Bách Hợp, Hào môn thế gia…) GIỮ NGUYÊN.
DELETE FROM "Genre" g
WHERE NOT EXISTS (SELECT 1 FROM "_GenreToStory" s WHERE s."A" = g.id)
  AND (
       -- Nhóm 2: sai facet (đã ở Thể loại) / trùng / không phải tag / có emoji
       (g.type = 'LUU_PHAI'  AND g.name IN ('Xuyên Không','Xuyên Nhanh','Trọng Sinh'))
    OR (g.type = 'BOI_CANH'  AND g.name = 'Phương Tây')
    OR (g.type = 'TINH_CACH' AND g.name IN ('1v1','Chủ thụ','HE','Nguyên sang','Ngược','Nữ Cường','Song khiết 🕊️','Sủng'))
       -- Nhóm 3: chưa có trong taxonomy → bỏ hẳn
    OR (g.type = 'GENRE'     AND g.name IN ('Cơ giáp','Dị Năng','Truyện Teen','Phá án','Kiếm Tam','Ma đạo tổ sư','Khác'))
  );

-- (4) ĐỐI CHIẾU — xem kết quả trước khi COMMIT
--     Số truyện mỗi tag phải khớp trước/sau (chỉ đổi type, không rớt liên kết).
SELECT g.type, g.name, COUNT(gs."B") AS so_truyen
FROM "Genre" g
LEFT JOIN "_GenreToStory" gs ON gs."A" = g.id
GROUP BY g.type, g.name
ORDER BY g.type, so_truyen DESC, g.name;

SELECT type, COUNT(*) AS so_tag FROM "Genre" GROUP BY type ORDER BY type;

-- Nếu kết quả OK → giữ COMMIT bên dưới.
-- Nếu muốn huỷ → đổi COMMIT thành ROLLBACK rồi chạy lại.
COMMIT;

-- Dọn backup sau khi chắc chắn ổn (chạy tay khi yên tâm):
--   DROP TABLE "Genre_bak"; DROP TABLE "_GenreToStory_bak";
