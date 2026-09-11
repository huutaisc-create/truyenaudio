// src/lib/notify.ts
// Helper tạo/gộp thông báo tương tác (reply/like/mention).
// LƯU Ý: chỗ này CHỈ ghi DB (để badge + màn thông báo hoạt động qua fetch-on-resume).
// Gửi FCM push thật sẽ nối sau khi cấu hình firebase-admin (xem TODO ở dưới).
import db from '@/lib/db';

export type NotifType = 'COMMENT_REPLY' | 'COMMENT_LIKE' | 'CHAT_MENTION';

interface CreateNotifInput {
  recipientId: string;
  actorId: string;
  type: NotifType;
  groupKey: string; // gộp: cùng (recipient, groupKey) mà chưa đọc thì gộp vào 1 dòng
  storyId?: string | null;
  commentId?: string | null;
  roomId?: string | null;
  messageId?: string | null;
}

/**
 * Tạo hoặc gộp 1 thông báo.
 * - Không tự báo cho chính mình (recipientId === actorId → bỏ qua).
 * - Nếu đã có dòng CHƯA ĐỌC cùng groupKey → cập nhật (đẩy lên đầu, tăng actorCount khi actor mới).
 * Trả về notification (hoặc null nếu bỏ qua).
 */
export async function createNotification(input: CreateNotifInput) {
  const { recipientId, actorId, type, groupKey } = input;
  if (recipientId === actorId) return null; // không tự báo mình

  const existing = await db.notification.findFirst({
    where: { recipientId, groupKey, isRead: false },
    select: { id: true, actorId: true },
  });

  let notif;
  if (existing) {
    notif = await db.notification.update({
      where: { id: existing.id },
      data: {
        actorId,
        // chỉ tăng khi actor khác actor gần nhất (tránh 1 người thổi số bằng like/unlike)
        actorCount:
          existing.actorId && existing.actorId !== actorId ? { increment: 1 } : undefined,
        updatedAt: new Date(),
      },
    });
  } else {
    notif = await db.notification.create({
      data: {
        recipientId,
        actorId,
        type,
        groupKey,
        storyId: input.storyId ?? null,
        commentId: input.commentId ?? null,
        roomId: input.roomId ?? null,
        messageId: input.messageId ?? null,
        actorCount: 1,
      },
    });
  }

  // TODO(FCM): sau khi cấu hình firebase-admin + service account:
  //   - COMMENT_REPLY / CHAT_MENTION → gửi push NGAY tại đây.
  //   - COMMENT_LIKE → KHÔNG push ở đây; để cron ~5 phút gom (dựa vào lastPushedAt).
  //   Lấy token: db.userFcmToken.findMany({ where: { userId: recipientId } }).

  return notif;
}
