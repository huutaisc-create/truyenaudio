// src/app/api/cron/cleanup/route.ts
// Dọn dữ liệu cũ — chạy 1 LẦN/NGÀY bằng crontab:
//   30 3 * * * curl -s -H "Authorization: Bearer $CRON_SECRET" https://api.mytruyenaudio.com/api/cron/cleanup
//
// VÌ SAO CẦN: mỗi lần báo "truyện mới" sinh MỘT dòng Notification cho TỪNG user.
// 5.000 user × 10 truyện/ngày = 50.000 dòng/ngày. Không dọn thì bảng phình mãi,
// và chính màn Thông báo (query theo recipientId, sắp xếp updatedAt) chậm dần.
//
// VÌ SAO TÁCH KHỎI /api/cron/notify-push: cái kia chạy mỗi phút, dọn dẹp thì mỗi
// ngày một lần là đủ. Để chung thì 1.439 lượt còn lại phải gánh thêm một query
// vô ích, và hôm nào xoá nhiều sẽ làm chậm luôn đường đi của thông báo.
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { checkCronSecret } from '@/lib/cronAuth';

/** Giữ lại thông báo trong bao nhiêu ngày. Đổi được bằng env, mặc định 30. */
const RETENTION_DAYS = Number(process.env.NOTIFICATION_RETENTION_DAYS || 30);

/** Xoá theo lô — DELETE một phát vài trăm nghìn dòng sẽ khoá bảng khá lâu. */
const BATCH = 5000;
/** Tối đa mấy lô mỗi lượt chạy (= 100k dòng). Còn dư thì hôm sau dọn tiếp. */
const MAX_BATCHES = 20;

export async function GET(req: Request) {
  if (!checkCronSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Chặn cấu hình sai: NOTIFICATION_RETENTION_DAYS="abc" hoặc 0 sẽ thành "xoá sạch".
  if (!Number.isFinite(RETENTION_DAYS) || RETENTION_DAYS < 1) {
    return NextResponse.json(
      { error: 'NOTIFICATION_RETENTION_DAYS không hợp lệ (phải là số ngày >= 1)' },
      { status: 500 }
    );
  }

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

  try {
    let deleted = 0;
    let batches = 0;

    while (batches < MAX_BATCHES) {
      // Xoá theo id lấy từ subquery có LIMIT: Postgres không cho LIMIT thẳng trong
      // DELETE. Mốc so sánh là createdAt (lúc sinh ra) chứ KHÔNG phải updatedAt —
      // updatedAt bị đẩy lên mỗi lần thông báo được gộp thêm, dùng nó thì một dòng
      // liên tục có người like sẽ không bao giờ tới hạn dọn.
      const n = await db.$executeRaw`
        DELETE FROM "Notification"
        WHERE "id" IN (
          SELECT "id" FROM "Notification"
          WHERE "createdAt" < ${cutoff}
          LIMIT ${BATCH}
        )
      `;
      deleted += n;
      batches++;
      if (n < BATCH) break; // hết dòng tới hạn
    }

    // Dòng hàng đợi truyện đã xả xong từ lâu và không còn nợ gì → bỏ đi.
    // Giữ lastSentAt của những dòng mới hơn vì cửa chặn 30 phút còn dựa vào nó.
    const queueCleaned = await db.$executeRaw`
      DELETE FROM "StoryAnnounceQueue"
      WHERE "pendingSince" IS NULL
        AND "lastSentAt" IS NOT NULL
        AND "lastSentAt" < ${cutoff}
    `;

    return NextResponse.json({
      success: true,
      retentionDays: RETENTION_DAYS,
      cutoff: cutoff.toISOString(),
      notificationsDeleted: deleted,
      queueRowsDeleted: queueCleaned,
      // true = còn dư, hôm sau dọn tiếp (hoặc gọi lại tay nếu muốn dọn hết ngay).
      moreLeft: batches >= MAX_BATCHES,
    });
  } catch (error) {
    console.error('cron/cleanup error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
