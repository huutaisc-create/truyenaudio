// ⚠️ ĐỌC KỸ: file này TÊN CŨ nhưng VẪN ĐANG CHẠY — đừng xoá nhầm.
//
// `ensureTamChuyenRoom()` hiện được KÊNH BÀI ĐĂNG dùng lại: `/api/channel/read`
// và `/api/channel/unread-count` lấy `roomId` từ đây để đọc/ghi mốc `lastReadAt`
// trong bảng `ChatRoomRead`. Kênh chỉ cần đúng một mốc thời gian nên tái sử dụng
// bảng sẵn có thay vì tạo bảng mới.
//
// Các route `/api/chat/room/*` (mô hình nhắn tin cũ) cũng còn import file này,
// nhưng chúng đã chết. Slug `tam-chuyen` và id `room_tam_chuyen` giữ nguyên vì
// đổi là phải sửa dữ liệu thật trong DB, trong khi người dùng không nhìn thấy.
//
// Chi tiết: Social_Final.md — PHẦN 8.7.
// src/lib/chatRoom.ts
// Helper dùng chung cho phòng chat "Tám chuyện" (1 phòng công khai duy nhất).
import db from '@/lib/db';

export const TAM_CHUYEN_SLUG = 'tam-chuyen';
export const TAM_CHUYEN_ID = 'room_tam_chuyen'; // id cố định, khớp seed trong prisma/social-migration.sql

/**
 * Đảm bảo phòng "tam-chuyen" tồn tại (tự tạo nếu migration SQL chưa chạy ở env này).
 * Idempotent — an toàn gọi mỗi request (upsert theo slug unique).
 */
export async function ensureTamChuyenRoom(): Promise<string> {
  const room = await db.chatRoom.upsert({
    where: { slug: TAM_CHUYEN_SLUG },
    update: {},
    create: { id: TAM_CHUYEN_ID, slug: TAM_CHUYEN_SLUG, name: 'Tám Chuyện', type: 'PUBLIC' },
    select: { id: true },
  });
  return room.id;
}
