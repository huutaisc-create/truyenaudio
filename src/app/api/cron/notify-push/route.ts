// src/app/api/cron/notify-push/route.ts
// Cron ~5 phút: gom & bắn push cho COMMENT_LIKE (reply/mention đã push NGAY lúc tạo, xem notify.ts).
// Gọi định kỳ bằng crontab trên VPS, ví dụ:
//   */5 * * * * curl -s -H "Authorization: Bearer $CRON_SECRET" https://api.mytruyenaudio.com/api/cron/notify-push
//
// Bắt buộc set env CRON_SECRET (fail-closed — giống JWT_SECRET, thiếu là từ chối chạy).
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { sendPushToUser } from '@/lib/fcm';

const BATCH_LIMIT = 500;

function checkSecret(req: Request): boolean {
  const configured = process.env.CRON_SECRET;
  if (!configured) return false; // fail-closed: chưa cấu hình → không chạy

  const authHeader = req.headers.get('Authorization');
  if (authHeader === `Bearer ${configured}`) return true;

  const { searchParams } = new URL(req.url);
  if (searchParams.get('secret') === configured) return true;

  return false;
}

interface DueRow {
  id: string;
  recipientId: string;
  actorId: string | null;
  actorCount: number;
  commentId: string | null;
  storyId: string | null;
  storySlug: string | null;
  rootCommentId: string | null;
  preview: string | null;
}

export async function GET(req: Request) {
  if (!checkSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // So sánh CỘT-với-CỘT (updatedAt > lastPushedAt) → không seek được bằng Prisma where thường,
    // dùng raw SQL trên partial index "Notification_unread_idx" (WHERE isRead = false).
    const due = await db.$queryRaw<DueRow[]>`
      SELECT "id", "recipientId", "actorId", "actorCount", "commentId", "storyId", "storySlug", "rootCommentId", "preview"
      FROM "Notification"
      WHERE "isRead" = false
        AND "type" = 'COMMENT_LIKE'
        AND ("lastPushedAt" IS NULL OR "updatedAt" > "lastPushedAt")
      ORDER BY "updatedAt" ASC
      LIMIT ${BATCH_LIMIT}
    `;

    if (due.length === 0) {
      return NextResponse.json({ success: true, pushed: 0 });
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
      const body = `${actorName}${others} đã thích bình luận của bạn${n.preview ? `: ${n.preview}` : ''}`;

      const sent = await sendPushToUser(n.recipientId, {
        title: 'Có lượt thích mới',
        body,
        data: {
          type: 'COMMENT_LIKE',
          notificationId: n.id,
          storyId: n.storyId ?? '',
          storySlug: n.storySlug ?? '',
          commentId: n.commentId ?? '',
          rootCommentId: n.rootCommentId ?? '',
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

    return NextResponse.json({ success: true, pushed, skipped });
  } catch (error) {
    console.error('cron/notify-push error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
