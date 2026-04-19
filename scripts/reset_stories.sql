-- reset_stories.sql
-- Xóa toàn bộ data truyện, giữ nguyên User và các bảng không liên quan
-- Chạy trong Neon SQL Editor của webtruyen-app DB

-- Tắt trigger tạm thời để tránh lỗi foreign key
SET session_replication_role = replica;

TRUNCATE TABLE
    "ReadingHistory",
    "Library",
    "Review",
    "CommentLike",
    "Comment",
    "Like",
    "Nomination",
    "StoryRequest",
    "Chapter",
    "_GenreToStory",   -- bảng join many-to-many giữa Genre và Story
    "Story",
    "Genre"
CASCADE;

-- Bật lại trigger
SET session_replication_role = DEFAULT;
