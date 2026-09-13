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
