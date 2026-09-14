// src/lib/notify.ts
// Helper tạo/gộp thông báo tương tác (reply/like/mention).
// Ghi DB (badge + màn thông báo qua fetch-on-resume) + bắn FCM push ngay cho
// COMMENT_REPLY/CHAT_MENTION (xem src/lib/fcm.ts). COMMENT_LIKE KHÔNG push ở đây —
// để /api/cron/notify-push gộp theo actorCount rồi push 1 lần (throttle).
import db from '@/lib/db';
import { sendPushToUser } from '@/lib/fcm';

export type NotifType = 'COMMENT_REPLY' | 'COMMENT_LIKE' | 'CHAT_MENTION';

interface CreateNotifInput {
  recipientId: string;
  actorId: string;
  type: NotifType;
  groupKey: string; // gộp: cùng (recipient, groupKey) mà chưa đọc thì gộp vào 1 dòng
  storyId?: string | null;
  storySlug?: string | null;
  commentId?: string | null;
  rootCommentId?: string | null;
  roomId?: string | null;
  messageId?: string | null;
  /** Bài đăng kênh. CÓ postId → client mở BÀI ĐĂNG; không có → mở truyện.
   *  (Cố ý không thêm giá trị enum mới — xem prisma/social-migration-4.sql.) */
  postId?: string | null;
  preview?: string | null;
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
        storySlug: input.storySlug ?? undefined,
        rootCommentId: input.rootCommentId ?? undefined,
        postId: input.postId ?? undefined,
        preview: input.preview ?? undefined,
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
        storySlug: input.storySlug ?? null,
        commentId: input.commentId ?? null,
        rootCommentId: input.rootCommentId ?? null,
        roomId: input.roomId ?? null,
        messageId: input.messageId ?? null,
        postId: input.postId ?? null,
        preview: input.preview ?? null,
        actorCount: 1,
      },
    });
  }

  // Reply/mention: người ta mong phản hồi tức thì → push NGAY, fire-and-forget
  // (không await — người gửi không phải đợi push xong, xem Social.md 2.1).
  if (type === 'COMMENT_REPLY' || type === 'CHAT_MENTION') {
    void pushImmediate(notif.id, recipientId, actorId, type, input);
  }

  return notif;
}

async function pushImmediate(
  notificationId: string,
  recipientId: string,
  actorId: string,
  type: NotifType,
  input: CreateNotifInput
) {
  const actor = await db.user.findUnique({ where: { id: actorId }, select: { name: true } });
  const actorName = actor?.name || 'Ai đó';
  const preview = input.preview ? `: ${input.preview}` : '';

  const title =
    type === 'COMMENT_REPLY' ? 'Có người trả lời bình luận của bạn' : 'Bạn được nhắc đến trong Tám Chuyện';
  const body = `${actorName}${preview}`;

  await sendPushToUser(recipientId, {
    title,
    body,
    highPriority: true,
    data: {
      type,
      notificationId,
      storySlug: input.storySlug ?? '',
      commentId: input.commentId ?? '',
      rootCommentId: input.rootCommentId ?? '',
      roomId: input.roomId ?? '',
      messageId: input.messageId ?? '',
      postId: input.postId ?? '',
    },
  });
}
