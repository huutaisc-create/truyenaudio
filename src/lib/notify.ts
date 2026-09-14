// src/lib/notify.ts
// Helper tạo/gộp thông báo tương tác (reply/like/mention).
// Ghi DB (badge + màn thông báo qua fetch-on-resume) + bắn FCM push NGAY cho
// COMMENT_REPLY/CHAT_MENTION, và cho COMMENT_LIKE khi đó là LƯỢT THÍCH ĐẦU TIÊN
// của nhóm (dòng thông báo vừa được tạo mới).
//
// Vì sao like cũng push ngay ở lượt đầu: trước đây like giao hết cho cron 5 phút,
// nên chuông trong app (fetch-on-resume) đã nhảy số từ lâu mà thông báo hệ thống
// mãi sau mới tới — nhìn như hỏng. Từ lượt thứ hai trở đi mới để cron gộp theo
// actorCount rồi bắn 1 lần, để 20 người thích cùng lúc không thành 20 lần rung máy.
import db from '@/lib/db';
import { sendPushToUser, type PushChannel } from '@/lib/fcm';

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
  // Like: chỉ push ngay ở lượt ĐẦU (existing == null); lượt sau để cron gộp.
  const pushNow =
    type === 'COMMENT_REPLY' || type === 'CHAT_MENTION' || (type === 'COMMENT_LIKE' && !existing);
  if (pushNow) {
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

  // Bình luận GỐC dưới một bài đăng cũng dùng loại COMMENT_REPLY (khỏi thêm enum),
  // phân biệt bằng: có postId mà KHÔNG có rootCommentId → không phải trả lời ai cả.
  const isPostComment = !!input.postId && !input.rootCommentId;
  // Thích BÀI ĐĂNG (không kèm commentId) khác thích BÌNH LUẬN.
  const isPostLike = !!input.postId && !input.commentId;

  const title =
    type === 'COMMENT_REPLY'
      ? isPostComment
        ? 'Có bình luận mới trong bài đăng của bạn'
        : 'Có người trả lời bình luận của bạn'
      : type === 'COMMENT_LIKE'
        ? isPostLike
          ? 'Có người thích bài đăng của bạn'
          : 'Có lượt thích mới'
        : 'Bạn được nhắc đến trong Tám Chuyện';
  const body = `${actorName}${preview}`;
  const channel: PushChannel = type === 'COMMENT_LIKE' ? 'like' : 'comment';

  const sent = await sendPushToUser(recipientId, {
    title,
    body,
    highPriority: true,
    channel, // nhóm chức năng (để người dùng tắt/bật riêng trong Cài đặt)
    // Tag = id của DÒNG thông báo này. Lượt thích tiếp theo của cùng bình luận sẽ
    // gộp vào đúng dòng đó và push lại với cùng tag → thay thế, không chất đống.
    // Bình luận khác, truyện khác thì tag khác → hiện thành dòng riêng.
    tag: notificationId,
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

  // Đánh dấu ĐÃ ĐẨY để cron khỏi bắn lại đúng thông báo này 5 phút sau.
  // PHẢI dùng raw SQL: Notification.updatedAt khai báo @updatedAt nên
  // db.notification.update() sẽ tự bump updatedAt lên muộn hơn lastPushedAt, và
  // điều kiện quét của cron (updatedAt > lastPushedAt) lại thành đúng ngay lập tức
  // → user nhận lại cùng một thông báo mỗi 5 phút (xem cron/notify-push).
  if (sent) {
    await db.$executeRaw`UPDATE "Notification" SET "lastPushedAt" = now() WHERE "id" = ${notificationId}`;
  }
}
