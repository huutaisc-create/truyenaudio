// src/app/api/cron/notify-push/route.ts
// Cron ~5 phút, làm 2 việc:
//   1. Gom & bắn push cho COMMENT_LIKE (reply/mention đã push NGAY lúc tạo, xem notify.ts).
//   2. Xả hàng đợi thông báo TRUYỆN MỚI / TRUYỆN CẬP NHẬT (xem src/lib/storyAnnounce.ts).
// Gọi định kỳ bằng crontab trên VPS, ví dụ:
//   */5 * * * * curl -s -H "Authorization: Bearer $CRON_SECRET" https://api.mytruyenaudio.com/api/cron/notify-push
//
// Bắt buộc set env CRON_SECRET (fail-closed — giống JWT_SECRET, thiếu là từ chối chạy).
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { sendPushToUser } from '@/lib/fcm';
import { flushStoryAnnouncements } from '@/lib/storyAnnounce';
import { checkCronSecret } from '@/lib/cronAuth';

const BATCH_LIMIT = 500;

interface DueRow {
  id: string;
  recipientId: string;
  actorId: string | null;
  actorCount: number;
  commentId: string | null;
  postId: string | null;
  storyId: string | null;
  storySlug: string | null;
  rootCommentId: string | null;
  preview: string | null;
}

export async function GET(req: Request) {
  if (!checkCronSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // So sánh CỘT-với-CỘT (updatedAt > lastPushedAt) → không seek được bằng Prisma where thường,
    // dùng raw SQL trên partial index "Notification_unread_idx" (WHERE isRead = false).
    const due = await db.$queryRaw<DueRow[]>`
      SELECT "id", "recipientId", "actorId", "actorCount", "commentId", "postId", "storyId", "storySlug", "rootCommentId", "preview"
      FROM "Notification"
      WHERE "isRead" = false
        AND "type" = 'COMMENT_LIKE'
        AND ("lastPushedAt" IS NULL OR "updatedAt" > "lastPushedAt")
      ORDER BY "updatedAt" ASC
      LIMIT ${BATCH_LIMIT}
    `;

    // Hàng đợi truyện chạy ĐỘC LẬP với thông báo like — không được để việc "không có
    // like nào tới hạn" làm cả lượt cron thoát sớm và truyện mới nằm chờ mãi.
    const stories = await flushStoryAnnouncements();

    if (due.length === 0) {
      return NextResponse.json({ success: true, pushed: 0, stories });
    }

    const actorIds = [...new Set(due.map((n) => n.actorId).filter(Boolean))] as string[];
    const actors = actorIds.length
      ? await db.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } })
      : [];
    const actorMap = new Map(actors.map((a) => [a.id, a.name || 'Ai đó']));

    let pushed = 0;
    let skipped = 0;
    for (const n of due) {
      const actorName = n.actorId ? actorMap.get(n.actorId) ?? 'Ai đó' : 'Ai đó';
      const others = n.actorCount > 1 ? ` và ${n.actorCount - 1} người khác` : '';
      // Thích BÀI ĐĂNG (có postId, không có commentId) khác thích BÌNH LUẬN.
      const isPostLike = !!n.postId && !n.commentId;
      const what = isPostLike ? 'bài đăng' : 'bình luận';
      const body = `${actorName}${others} đã thích ${what} của bạn${n.preview ? `: ${n.preview}` : ''}`;

      const sent = await sendPushToUser(n.recipientId, {
        title: isPostLike ? 'Có người thích bài đăng của bạn' : 'Có lượt thích mới',
        body,
        // TRƯỚC ĐÂY THIẾU 2 DÒNG NÀY nên push like bị Android hoãn/nuốt khi máy
        // ngủ (priority mặc định = normal). Đó là lý do tắt app thì chỉ thấy thông
        // báo bài đăng (vốn để high) mà không thấy like.
        highPriority: true,
        channel: 'like',
        data: {
          type: 'COMMENT_LIKE',
          notificationId: n.id,
          storyId: n.storyId ?? '',
          storySlug: n.storySlug ?? '',
          commentId: n.commentId ?? '',
          rootCommentId: n.rootCommentId ?? '',
          // THIẾU DÒNG NÀY thì bấm vào thông báo lượt thích trên bài đăng sẽ không
          // đi đâu cả: app dựa vào postId để biết mở bài nào, không có thì nó quay
          // sang storySlug — mà thông báo của kênh thì storySlug rỗng.
          postId: n.postId ?? '',
        },
      });

      // CHƯA gửi được (thiếu FIREBASE_SERVICE_ACCOUNT_BASE64 hoặc lỗi tạm thời)
      // → KHÔNG set lastPushedAt, để lượt cron sau gửi lại. Đánh dấu bừa ở đây
      // đồng nghĩa thông báo đó vĩnh viễn không bao giờ được đẩy đi.
      if (!sent) {
        skipped++;
        continue;
      }

      // PHẢI dùng raw SQL, KHÔNG dùng db.notification.update():
      // Notification.updatedAt khai báo @updatedAt nên Prisma sẽ tự bump nó ở
      // mọi lệnh update, với timestamp sinh lúc query chạy — tức muộn hơn giá
      // trị lastPushedAt mà JS tính trước đó. Điều kiện quét của cron là
      // (updatedAt > lastPushedAt) nên dòng vừa đánh dấu lại "đến hạn" ngay,
      // và user nhận lại đúng thông báo đó mỗi 5 phút cho tới khi đọc nó.
      // now() của Postgres chạy sau, còn updatedAt giữ nguyên → hết lặp.
      await db.$executeRaw`UPDATE "Notification" SET "lastPushedAt" = now() WHERE "id" = ${n.id}`;
      pushed++;
    }

    return NextResponse.json({ success: true, pushed, skipped, stories });
  } catch (error) {
    console.error('cron/notify-push error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
