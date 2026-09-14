// src/lib/fcm.ts
// Gửi FCM push thật qua firebase-admin. Dùng chung project Firebase với app Flutter
// (google-services.json, project_id: app-truyen-c450a).
//
// SETUP (làm 1 lần, cả dev lẫn VPS prod):
//   1. Firebase Console → Project Settings → Service Accounts → Generate new private key
//      (đúng project "app-truyen-c450a" — project đang dùng cho Google Sign-In/google-services.json).
//   2. Base64 encode file JSON tải về:
//        Windows PowerShell: [Convert]::ToBase64String([IO.File]::ReadAllBytes("service-account.json")) | Set-Clipboard
//        Linux/VPS:          base64 -w0 service-account.json
//   3. Set biến env FIREBASE_SERVICE_ACCOUNT_BASE64 = chuỗi base64 đó
//      (.env.local cho dev, .env trên VPS cho prod — KHÔNG commit file JSON gốc vào git).
//   4. npm install firebase-admin (đã thêm vào package.json, chạy npm install để lấy).
//
// Nếu chưa set biến env → sendPushToUser() im lặng bỏ qua (không throw), app vẫn chạy
// bình thường bằng fetch-on-resume, chỉ là chưa có push tức thời.

import { initializeApp, cert, getApps, type App } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import db from '@/lib/db';

let cachedApp: App | null | undefined; // undefined = chưa thử khởi tạo, null = đã thử nhưng fail/thiếu env

function getFirebaseApp(): App | null {
  if (cachedApp !== undefined) return cachedApp;

  if (getApps().length) {
    cachedApp = getApps()[0];
    return cachedApp;
  }

  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (!b64) {
    console.warn('[fcm] Thiếu FIREBASE_SERVICE_ACCOUNT_BASE64 — bỏ qua gửi push (chỉ ghi DB).');
    cachedApp = null;
    return null;
  }

  try {
    const serviceAccount = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
    cachedApp = initializeApp({ credential: cert(serviceAccount) });
    return cachedApp;
  } catch (error) {
    console.error('[fcm] Không parse được FIREBASE_SERVICE_ACCOUNT_BASE64:', error);
    cachedApp = null;
    return null;
  }
}

/**
 * Kênh thông báo Android — GOM THÔNG BÁO THEO CHỨC NĂNG.
 *
 * Mỗi loại một `channelId` + một `tag`:
 *  - channelId: Android xếp thông báo vào đúng nhóm, và người dùng tắt/bật riêng
 *    từng loại trong Cài đặt (vd chỉ muốn nhận truyện cập nhật, không muốn like).
 *    ⚠ Kênh phải được TẠO PHÍA APP thì mới có tác dụng phân loại. Chừng nào app
 *    chưa tạo, Android dồn hết vào kênh mặc định — thông báo vẫn hiện bình thường,
 *    chỉ là chưa tách nhóm được (xem ghi chú trong Social_Final.md).
 *  - tag: thông báo cùng tag sẽ THAY THẾ nhau trên khay thay vì chất đống. Ví dụ
 *    3 truyện cập nhật liên tiếp không đẩy thành 3 dòng riêng.
 */
export const PUSH_CHANNELS = {
  comment: { id: 'noti_comment', tag: 'comment' },   // trả lời / nhắc tên
  like: { id: 'noti_like', tag: 'like' },            // lượt thích
  post: { id: 'noti_post', tag: 'post' },            // bảng tin (bài đăng kênh)
  newStory: { id: 'noti_story_new', tag: 'story_new' },
  storyUpdate: { id: 'noti_story_update', tag: 'story_update' },
} as const;

export type PushChannel = keyof typeof PUSH_CHANNELS;

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  highPriority?: boolean;
  /** Nhóm chức năng của thông báo — xem PUSH_CHANNELS. */
  channel?: PushChannel;
}

/**
 * Dựng phần cấu hình Android của message.
 *
 * ⚠ priority PHẢI là 'high' cho mọi thông báo người dùng cần thấy ngay. Với
 * priority 'normal', Android ở chế độ Doze (máy nằm yên, màn hình tắt — đúng lúc
 * app đã đóng) được phép HOÃN message tới hàng chục phút hoặc gộp bỏ. Đây chính
 * là lý do push bài đăng (đang để high) thì hiện, còn push like bình luận (để
 * mặc định normal) thì im ru khi tắt app.
 */
function androidConfig(payload: PushPayload) {
  const ch = payload.channel ? PUSH_CHANNELS[payload.channel] : undefined;
  return {
    priority: (payload.highPriority === false ? 'normal' : 'high') as 'high' | 'normal',
    ...(ch ? { collapseKey: ch.tag } : {}),
    notification: {
      ...(ch ? { channelId: ch.id, tag: ch.tag } : {}),
      sound: 'default',
      // Bấm vào là mở app (Flutter tự nhận qua onMessageOpenedApp/getInitialMessage).
      clickAction: 'FLUTTER_NOTIFICATION_CLICK',
    },
  };
}

/**
 * Gửi push tới mọi thiết bị đã đăng ký (UserFcmToken) của 1 user.
 * - "Best effort": không bao giờ throw ra ngoài (push lỗi không được làm hỏng request chính).
 * - Tự xoá token unregistered/invalid khỏi DB để lần sau khỏi gửi lặp vô ích.
 *
 * Trả về `true` khi coi như ĐÃ XỬ LÝ XONG thông báo này (gửi đi rồi, hoặc user
 * không có thiết bị nào để gửi), `false` khi CHƯA gửi được vì lý do tạm thời
 * (chưa cấu hình FIREBASE_SERVICE_ACCOUNT_BASE64, hoặc lỗi lúc gửi).
 *
 * Cron dùng giá trị này để quyết định có set `lastPushedAt` hay không — nếu
 * đánh dấu bừa khi Firebase chưa cấu hình thì các thông báo đó vĩnh viễn không
 * bao giờ được gửi lại, kể cả sau khi đã thêm khoá.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<boolean> {
  try {
    const fbApp = getFirebaseApp();
    if (!fbApp) return false; // chưa cấu hình khoá → để cron thử lại sau

    const tokens = await db.userFcmToken.findMany({
      where: { userId },
      select: { token: true },
    });
    if (tokens.length === 0) return true; // không có thiết bị → khỏi thử lại mãi

    const messaging = getMessaging(fbApp);
    const res = await messaging.sendEachForMulticast({
      tokens: tokens.map((t) => t.token),
      notification: { title: payload.title, body: payload.body },
      data: payload.data ?? {},
      android: androidConfig(payload),
    });

    const deadTokens: string[] = [];
    res.responses.forEach((r, i) => {
      if (!r.success) {
        const code = r.error?.code ?? '';
        if (
          code.includes('registration-token-not-registered') ||
          code.includes('invalid-argument')
        ) {
          deadTokens.push(tokens[i].token);
        }
      }
    });
    if (deadTokens.length > 0) {
      await db.userFcmToken.deleteMany({ where: { token: { in: deadTokens } } });
    }
    return true;
  } catch (error) {
    console.error('[fcm] sendPushToUser error:', error);
    return false; // lỗi tạm thời → cron thử lại lượt sau
  }
}

/**
 * Gửi push cho TOÀN BỘ thiết bị đã đăng ký — dùng khi admin đăng bài mới ở kênh.
 *
 * KHÁC sendPushToUser ở chỗ đây là broadcast: KHÔNG tạo bản ghi Notification cho
 * từng người (vài nghìn user = vài nghìn dòng cho một sự kiện duy nhất). Người
 * dùng biết có bài mới qua chấm đỏ trên tab, push chỉ để "tới ngay".
 *
 * Trả về số thiết bị gửi thành công. Không bao giờ throw.
 */
export async function sendPushToAllDevices(payload: PushPayload): Promise<number> {
  try {
    const fbApp = getFirebaseApp();
    if (!fbApp) return 0;

    const tokens = await db.userFcmToken.findMany({ select: { token: true } });
    if (tokens.length === 0) return 0;

    const messaging = getMessaging(fbApp);
    const deadTokens: string[] = [];
    let sent = 0;

    // sendEachForMulticast chỉ nhận tối đa 500 token mỗi lần → chia lô.
    const CHUNK = 500;
    for (let i = 0; i < tokens.length; i += CHUNK) {
      const chunk = tokens.slice(i, i + CHUNK);
      const res = await messaging.sendEachForMulticast({
        tokens: chunk.map((t) => t.token),
        notification: { title: payload.title, body: payload.body },
        data: payload.data ?? {},
        android: androidConfig(payload),
      });

      sent += res.successCount;
      res.responses.forEach((r, idx) => {
        if (r.success) return;
        const code = r.error?.code ?? '';
        if (
          code.includes('registration-token-not-registered') ||
          code.includes('invalid-argument')
        ) {
          deadTokens.push(chunk[idx].token);
        }
      });
    }

    if (deadTokens.length > 0) {
      await db.userFcmToken.deleteMany({ where: { token: { in: deadTokens } } });
    }
    return sent;
  } catch (error) {
    console.error('[fcm] sendPushToAllDevices error:', error);
    return 0;
  }
}

/**
 * Gửi push cho MỘT DANH SÁCH user (vd mọi người đang theo dõi một truyện).
 *
 * Khác việc gọi sendPushToUser() trong vòng lặp ở chỗ: lấy token của tất cả họ
 * bằng MỘT query rồi bắn theo lô 500. Một truyện có 2.000 người theo dõi mà lặp
 * thì thành 2.000 query + 2.000 lần gọi Firebase.
 *
 * Trả về số thiết bị gửi thành công. Không bao giờ throw.
 */
export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<number> {
  if (userIds.length === 0) return 0;
  try {
    const fbApp = getFirebaseApp();
    if (!fbApp) return 0;

    const tokens = await db.userFcmToken.findMany({
      where: { userId: { in: userIds } },
      select: { token: true },
    });
    if (tokens.length === 0) return 0;

    const messaging = getMessaging(fbApp);
    const deadTokens: string[] = [];
    let sent = 0;

    const CHUNK = 500; // giới hạn cứng của sendEachForMulticast
    for (let i = 0; i < tokens.length; i += CHUNK) {
      const chunk = tokens.slice(i, i + CHUNK);
      const res = await messaging.sendEachForMulticast({
        tokens: chunk.map((t) => t.token),
        notification: { title: payload.title, body: payload.body },
        data: payload.data ?? {},
        android: androidConfig(payload),
      });

      sent += res.successCount;
      res.responses.forEach((r, idx) => {
        if (r.success) return;
        const code = r.error?.code ?? '';
        if (
          code.includes('registration-token-not-registered') ||
          code.includes('invalid-argument')
        ) {
          deadTokens.push(chunk[idx].token);
        }
      });
    }

    if (deadTokens.length > 0) {
      await db.userFcmToken.deleteMany({ where: { token: { in: deadTokens } } });
    }
    return sent;
  } catch (error) {
    console.error('[fcm] sendPushToUsers error:', error);
    return 0;
  }
}
