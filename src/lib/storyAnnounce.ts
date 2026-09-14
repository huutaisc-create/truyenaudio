// src/lib/storyAnnounce.ts
// Thông báo TRUYỆN MỚI và TRUYỆN CẬP NHẬT (có chương mới).
//
// LUỒNG: nơi thêm truyện/chương (POST /api/admin/stories) chỉ GHI NỢ vào bảng
// StoryAnnounceQueue — nhanh, không gọi Firebase, không làm chậm script import.
// Cron 5 phút (/api/cron/notify-push) gọi flushStoryAnnouncements() để gom và bắn.
//
// CỬA CHẶN 30 PHÚT (theo yêu cầu):
//   - Cập nhật chương: tính theo TỪNG TRUYỆN. Import 50 chương rải rác trong nửa
//     tiếng → vẫn chỉ 1 thông báo "Truyện X có 50 chương mới".
//   - Truyện mới: tính TOÀN CỤC. Thêm 10 truyện một lúc thì xếp hàng, cứ 30 phút
//     gọi tên 1 truyện (cũ nhất trước), không đổ ập 10 thông báo.
//
// AI NHẬN:
//   - Truyện mới     → TẤT CẢ user (push toàn bộ thiết bị + 1 dòng trong chuông mỗi người).
//   - Truyện cập nhật → người có truyện trong Tủ Sách (Library) HOẶC từng nghe (ReadingHistory).
import { randomUUID } from 'crypto';
import db from '@/lib/db';
import { sendPushToAllDevices, sendPushToUsers } from '@/lib/fcm';

/**
 * Cửa chặn giữa 2 lần báo, tính bằng phút. Mặc định 30.
 *
 * Đặt `STORY_ANNOUNCE_GATE_MINUTES=0` trong .env để TẮT HẲN cửa chặn — mỗi lượt cron
 * là báo ngay, dùng lúc test cho khỏi ngồi đợi nửa tiếng. Nhớ bỏ ra (hoặc trả về 30)
 * khi chạy thật, không thì import hàng loạt sẽ nổ máy người dùng liên tục.
 */
const GATE_MINUTES = (() => {
  const raw = Number(process.env.STORY_ANNOUNCE_GATE_MINUTES);
  return Number.isFinite(raw) && raw >= 0 ? raw : 30;
})();

/** Thời điểm "cũ hơn mốc này thì được phép báo tiếp". */
function gateCutoff(): Date {
  return new Date(Date.now() - GATE_MINUTES * 60 * 1000);
}
/** Mỗi lượt cron xử lý tối đa bấy nhiêu truyện cập nhật — tránh một lượt chạy quá lâu. */
const UPDATE_PER_RUN = 10;
/** Chèn Notification theo lô để không dựng câu SQL khổng lồ. */
const INSERT_CHUNK = 500;

// ─────────────────────────────────────────────────────────────
// GHI NỢ (gọi từ route tạo truyện / thêm chương)
// ─────────────────────────────────────────────────────────────

/** Truyện vừa được tạo → xếp hàng chờ báo "truyện mới". */
export async function queueNewStory(storyId: string): Promise<void> {
  try {
    await db.$executeRaw`
      INSERT INTO "StoryAnnounceQueue" ("id","storyId","kind","pendingCount","pendingSince","updatedAt")
      VALUES (${randomUUID()}, ${storyId}, 'NEW', 1, now(), now())
      ON CONFLICT ("storyId","kind") DO NOTHING
    `;
  } catch (error) {
    // Không bao giờ làm hỏng request chính chỉ vì không xếp hàng được thông báo.
    console.error('[storyAnnounce] queueNewStory error:', error);
  }
}

/** Truyện vừa có thêm `chapterCount` chương → cộng dồn vào hàng đợi. */
export async function queueStoryUpdate(storyId: string, chapterCount: number): Promise<void> {
  if (chapterCount <= 0) return;
  try {
    await db.$executeRaw`
      INSERT INTO "StoryAnnounceQueue" ("id","storyId","kind","pendingCount","pendingSince","updatedAt")
      VALUES (${randomUUID()}, ${storyId}, 'UPDATE', ${chapterCount}, now(), now())
      ON CONFLICT ("storyId","kind") DO UPDATE SET
        "pendingCount" = "StoryAnnounceQueue"."pendingCount" + ${chapterCount},
        -- Giữ nguyên mốc nợ CŨ NHẤT: cộng thêm chương không được coi là bắt đầu lại
        -- từ đầu, nếu không thì truyện đang được import liên tục sẽ chẳng bao giờ
        -- tới lượt báo.
        "pendingSince" = COALESCE("StoryAnnounceQueue"."pendingSince", now()),
        "updatedAt" = now()
    `;
  } catch (error) {
    console.error('[storyAnnounce] queueStoryUpdate error:', error);
  }
}

// ─────────────────────────────────────────────────────────────
// BẮN (gọi từ cron)
// ─────────────────────────────────────────────────────────────

interface QueueRow {
  id: string;
  storyId: string;
  pendingCount: number;
  title: string;
  slug: string;
}

export interface FlushResult {
  newStories: number;
  updatedStories: number;
  /** Số THIẾT BỊ Firebase nhận được — 0 nghĩa là không máy nào được đẩy. */
  devicesPushed: number;
  /** Số người nhận của các thông báo "truyện cập nhật" — 0 nghĩa là chưa ai theo dõi. */
  updateRecipients: number;
  /** Cửa chặn đang đặt bao nhiêu phút (để biết .env có ăn không). */
  gateMinutes: number;
}

export async function flushStoryAnnouncements(): Promise<FlushResult> {
  const result: FlushResult = {
    newStories: 0,
    updatedStories: 0,
    devicesPushed: 0,
    updateRecipients: 0,
    gateMinutes: GATE_MINUTES,
  };

  // ── 1) TRUYỆN MỚI — toàn cục, mỗi 30 phút đúng 1 truyện ──
  try {
    // Mốc chặn tính SẴN Ở JS rồi truyền vào như một timestamp. Không viết
    // `now() - interval '${...} minutes'`: chuỗi interval không nhận tham số, mà
    // nối thẳng số vào câu SQL thì mất lớp chống SQL injection của Prisma.
    const cutoff = gateCutoff();
    const gate = await db.$queryRaw<{ blocked: boolean }[]>`
      SELECT COALESCE(MAX("lastSentAt"), to_timestamp(0)) > ${cutoff} AS blocked
      FROM "StoryAnnounceQueue" WHERE "kind" = 'NEW'
    `;
    if (!gate[0]?.blocked) {
      const rows = await db.$queryRaw<QueueRow[]>`
        SELECT q."id", q."storyId", q."pendingCount", s."title", s."slug"
        FROM "StoryAnnounceQueue" q
        JOIN "Story" s ON s."id" = q."storyId"
        WHERE q."kind" = 'NEW' AND q."pendingSince" IS NOT NULL
          AND s."isHidden" = false
          -- Chưa có chương nào thì CHƯA báo: truyện tạo từ trang admin lúc đầu
          -- luôn rỗng, admin thêm chương sau. Báo sớm thì người bấm vào thông báo
          -- rơi vào một truyện trống. Dòng vẫn nằm trong hàng đợi, tự tới lượt khi
          -- có chương đầu tiên.
          AND s."totalChapters" > 0
        ORDER BY q."pendingSince" ASC
        LIMIT 1
      `;
      if (rows.length > 0) {
        result.devicesPushed += await announceNewStory(rows[0]);
        result.newStories = 1;
      }
    }
  } catch (error) {
    console.error('[storyAnnounce] flush NEW error:', error);
  }

  // ── 2) TRUYỆN CẬP NHẬT — theo từng truyện, mỗi truyện 30 phút một lần ──
  try {
    const rows = await db.$queryRaw<QueueRow[]>`
      SELECT q."id", q."storyId", q."pendingCount", s."title", s."slug"
      FROM "StoryAnnounceQueue" q
      JOIN "Story" s ON s."id" = q."storyId"
      WHERE q."kind" = 'UPDATE'
        AND q."pendingSince" IS NOT NULL
        AND q."pendingCount" > 0
        AND s."isHidden" = false
        AND (q."lastSentAt" IS NULL OR q."lastSentAt" < ${gateCutoff()})
      ORDER BY q."pendingSince" ASC
      LIMIT ${UPDATE_PER_RUN}
    `;
    for (const row of rows) {
      const r = await announceStoryUpdate(row);
      result.devicesPushed += r.sent;
      result.updateRecipients += r.recipients;
      result.updatedStories++;
    }
  } catch (error) {
    console.error('[storyAnnounce] flush UPDATE error:', error);
  }

  return result;
}

// ─────────────────────────────────────────────────────────────

/** Trả về số thiết bị đã đẩy được (để cron báo ra ngoài, tiện chẩn đoán). */
async function announceNewStory(row: QueueRow): Promise<number> {
  // Dòng trong chuông cho MỌI user. Lấy id theo lô để không nạp cả bảng User vào RAM.
  const users = await db.user.findMany({ select: { id: true } });
  await insertStoryNotifications(
    users.map((u) => u.id),
    row,
    'NEW_STORY',
    1
  );

  const sent = await sendPushToAllDevices({
    title: 'Truyện mới',
    body: row.title,
    highPriority: true,
    channel: 'newStory',
    // Tag theo TRUYỆN: hai truyện mới khác nhau phải là hai dòng riêng.
    tag: `story_new:${row.storyId}`,
    data: { type: 'NEW_STORY', storyId: row.storyId, storySlug: row.slug },
  });
  console.log(`[storyAnnounce] NEW "${row.title}" → đẩy tới ${sent} thiết bị`);

  // Xong nợ: xoá cờ, ghi mốc để cửa chặn 30 phút toàn cục có hiệu lực.
  await db.$executeRaw`
    UPDATE "StoryAnnounceQueue"
    SET "pendingCount" = 0, "pendingSince" = NULL, "lastSentAt" = now(), "updatedAt" = now()
    WHERE "id" = ${row.id}
  `;

  return sent;
}

async function announceStoryUpdate(row: QueueRow): Promise<{ sent: number; recipients: number }> {
  // Người theo dõi = có trong Tủ Sách HOẶC từng nghe truyện này.
  const [library, history] = await Promise.all([
    db.library.findMany({ where: { storyId: row.storyId }, select: { userId: true } }),
    db.readingHistory.findMany({ where: { storyId: row.storyId }, select: { userId: true } }),
  ]);
  const recipients = [...new Set([...library, ...history].map((r) => r.userId))];

  // Không ai theo dõi → vẫn phải xoá nợ, nếu không dòng này kẹt lại mãi trong hàng đợi.
  const count = row.pendingCount;
  let sent = 0;
  if (recipients.length > 0) {
    await insertStoryNotifications(recipients, row, 'STORY_UPDATE', count);

    sent = await sendPushToUsers(recipients, {
      title: row.title,
      body: count > 1 ? `Có ${count} chương mới` : 'Có chương mới',
      highPriority: true,
      channel: 'storyUpdate',
      // Tag theo TRUYỆN: truyện A và truyện B cùng có chương mới → hai dòng.
      // Cùng truyện A báo lần nữa (sau cửa chặn) → thay dòng cũ, hợp lý.
      tag: `story_update:${row.storyId}`,
      data: { type: 'STORY_UPDATE', storyId: row.storyId, storySlug: row.slug },
    });
  }
  console.log(
    `[storyAnnounce] UPDATE "${row.title}" +${count} chương → ${recipients.length} người theo dõi, đẩy tới ${sent} thiết bị`
  );

  // TRỪ ĐÚNG SỐ ĐÃ BÁO chứ không gán 0: trong lúc đang gửi có thể có chương mới
  // được ghi nợ thêm, gán 0 là nuốt mất phần đó.
  await db.$executeRaw`
    UPDATE "StoryAnnounceQueue"
    SET "pendingCount" = GREATEST("pendingCount" - ${count}, 0),
        "pendingSince" = CASE WHEN "pendingCount" - ${count} > 0 THEN now() ELSE NULL END,
        "lastSentAt" = now(),
        "updatedAt" = now()
    WHERE "id" = ${row.id}
  `;

  return { sent, recipients: recipients.length };
}

/**
 * Tạo/gộp dòng thông báo trong chuông cho một danh sách người nhận.
 *
 * Dùng INSERT ... ON CONFLICT trên partial unique index
 * `Notification_unread_group_uq (recipientId, groupKey) WHERE isRead = false`
 * (tạo ở social-migration.sql) → ai CHƯA ĐỌC thông báo cũ của truyện này thì gộp
 * vào đúng dòng đó, ai đọc rồi thì nhận dòng mới. Cách này rẻ hơn hẳn so với
 * findFirst + update cho từng người.
 *
 * `count` được ghi vào cột actorCount — thông báo hệ thống không có actor nên cột
 * đó đang trống, dùng lại làm SỐ CHƯƠNG MỚI (xem social-migration-5.sql).
 */
async function insertStoryNotifications(
  recipientIds: string[],
  row: QueueRow,
  type: 'NEW_STORY' | 'STORY_UPDATE',
  count: number
) {
  const groupKey = `${type === 'NEW_STORY' ? 'new_story' : 'story_update'}:${row.storyId}`;

  for (let i = 0; i < recipientIds.length; i += INSERT_CHUNK) {
    const chunk = recipientIds.slice(i, i + INSERT_CHUNK);
    const ids = chunk.map(() => randomUUID());
    try {
      await db.$executeRaw`
        INSERT INTO "Notification"
          ("id","recipientId","type","storyId","storySlug","groupKey","actorCount","isRead","lastPushedAt","createdAt","updatedAt")
        SELECT x.id, x.uid, ${type}::"NotificationType", ${row.storyId}, ${row.slug},
               ${groupKey}, ${count}, false, now(), now(), now()
        FROM unnest(${ids}::text[], ${chunk}::text[]) AS x(id, uid)
        ON CONFLICT ("recipientId","groupKey") WHERE "isRead" = false
        DO UPDATE SET
          "actorCount" = "Notification"."actorCount" + ${count},
          "lastPushedAt" = now(),
          "updatedAt" = now()
      `;
    } catch (error) {
      console.error('[storyAnnounce] insertStoryNotifications error:', error);
    }
  }
}
