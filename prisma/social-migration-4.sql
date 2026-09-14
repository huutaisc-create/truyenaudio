-- prisma/social-migration-4.sql
-- Kênh bài đăng "Tám Chuyện": admin đăng bài (text + ảnh), user thích và bình luận.
-- Thay thế mô hình nhắn tin ngang hàng (RoomMessage) — bảng cũ GIỮ NGUYÊN, không xoá.
--
-- CHẠY TRỰC TIẾP trên DB (KHÔNG dùng `prisma migrate dev`). Idempotent — chạy lại an toàn.
--   Prod (VPS):  psql "$DATABASE_URL" -f prisma/social-migration-4.sql
-- Sau đó: `npx prisma generate` (KHÔNG migrate).
--
-- GHI CHÚ THIẾT KẾ — vì sao KHÔNG dùng lại bảng Comment sẵn có:
--   Comment.storyId là NOT NULL và khoá ngoại cứng sang Story. Muốn tái sử dụng thì
--   phải cho storyId nhận null rồi thêm postId, đồng nghĩa sửa một bảng đang có dữ
--   liệu thật và rà lại mọi truy vấn `where: { storyId }` của màn Bình Luận đang chạy
--   tốt. Đổi lại việc lặp một ít logic, bảng riêng không đụng gì tới thứ đang hoạt động.

BEGIN;

-- 1) Bài đăng của kênh
CREATE TABLE IF NOT EXISTS "ChannelPost" (
  "id"           TEXT PRIMARY KEY,
  "content"      TEXT NOT NULL,
  "images"       TEXT[] NOT NULL DEFAULT '{}',          -- URL ảnh đã nén WebP qua /api/upload
  "status"       "CommentStatus" NOT NULL DEFAULT 'VISIBLE',
  "likeCount"    INTEGER NOT NULL DEFAULT 0,            -- denormalize: khỏi COUNT(*) mỗi lần load feed
  "commentCount" INTEGER NOT NULL DEFAULT 0,
  "authorId"     TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT now()
);
-- Feed luôn lấy bài mới nhất trước, chỉ lấy bài VISIBLE → partial index đúng hình truy vấn.
CREATE INDEX IF NOT EXISTS "ChannelPost_visible_createdAt_idx"
  ON "ChannelPost" ("createdAt" DESC) WHERE "status" = 'VISIBLE';

-- 2) Like bài đăng (toggle — unique chặn like 2 lần)
CREATE TABLE IF NOT EXISTS "ChannelPostLike" (
  "id"        TEXT PRIMARY KEY,
  "userId"    TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "postId"    TEXT NOT NULL REFERENCES "ChannelPost"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  CONSTRAINT "ChannelPostLike_userId_postId_key" UNIQUE ("userId", "postId")
);
CREATE INDEX IF NOT EXISTS "ChannelPostLike_postId_idx" ON "ChannelPostLike" ("postId");

-- 3) Bình luận bài đăng — nest 1 cấp, parentId LUÔN trỏ về comment gốc
CREATE TABLE IF NOT EXISTS "ChannelPostComment" (
  "id"         TEXT PRIMARY KEY,
  "content"    TEXT NOT NULL,
  "postId"     TEXT NOT NULL REFERENCES "ChannelPost"("id") ON DELETE CASCADE,
  "userId"     TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "parentId"   TEXT REFERENCES "ChannelPostComment"("id") ON DELETE CASCADE,
  "replyCount" INTEGER NOT NULL DEFAULT 0,
  "likeCount"  INTEGER NOT NULL DEFAULT 0,
  "status"     "CommentStatus" NOT NULL DEFAULT 'VISIBLE',
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "ChannelPostComment_postId_parentId_createdAt_idx"
  ON "ChannelPostComment" ("postId", "parentId", "createdAt");
CREATE INDEX IF NOT EXISTS "ChannelPostComment_parentId_createdAt_idx"
  ON "ChannelPostComment" ("parentId", "createdAt");

-- 4) Like bình luận
CREATE TABLE IF NOT EXISTS "ChannelPostCommentLike" (
  "id"        TEXT PRIMARY KEY,
  "userId"    TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "commentId" TEXT NOT NULL REFERENCES "ChannelPostComment"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  CONSTRAINT "ChannelPostCommentLike_userId_commentId_key" UNIQUE ("userId", "commentId")
);

-- 5) Notification: thêm postId để deep-link về bài đăng.
--
-- CỐ Ý KHÔNG thêm giá trị mới vào enum NotificationType. Dùng lại COMMENT_REPLY /
-- COMMENT_LIKE, phân biệt bằng việc postId có hay không: có postId → mở bài đăng,
-- không có → mở truyện. Lý do: `ALTER TYPE ... ADD VALUE` không chạy được trong
-- cùng transaction với chỗ dùng giá trị đó, và `IF NOT EXISTS` chỉ có từ PG 12 —
-- rủi ro không đáng cho một thứ mà thêm cột giải quyết gọn hơn.
ALTER TABLE "Notification"
  ADD COLUMN IF NOT EXISTS "postId" TEXT;

COMMIT;
