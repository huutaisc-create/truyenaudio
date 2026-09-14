// src/lib/rateLimit.ts
// Rate limit đơn giản, đếm TRONG BỘ NHỚ của tiến trình Next.
//
// GIỚI HẠN CẦN BIẾT TRƯỚC KHI DÙNG:
//  - Bộ đếm mất sạch mỗi lần `pm2 restart` / deploy. Kẻ spam kiên nhẫn chờ deploy
//    là được reset. Đủ để chặn spam thường, KHÔNG phải lớp bảo vệ nghiêm túc.
//  - Chỉ đúng khi chạy MỘT tiến trình. Hiện pm2 đang chạy fork mode 1 instance nên ổn.
//    Nếu sau này bật cluster / nhiều instance thì mỗi tiến trình giữ bộ đếm riêng,
//    giới hạn thực tế sẽ nhân lên theo số instance → lúc đó phải chuyển sang Redis
//    hoặc một bảng trong DB.

/** IP thật của client. Cloudflare đứng trước nên `cf-connecting-ip` là nguồn đáng tin nhất. */
export function getClientIp(req: Request): string {
  const h = req.headers;
  return (
    h.get('cf-connecting-ip') ??
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    h.get('x-real-ip') ??
    'unknown'
  );
}

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 10_000; // chặn map phình vô hạn nếu bị bơm IP giả

function sweepExpired(now: number): void {
  for (const [key, bucket] of buckets) {
    if (now > bucket.resetAt) buckets.delete(key);
  }
}

export interface RateLimitResult {
  ok: boolean;
  /** Số giây cần chờ trước khi thử lại (0 khi ok). */
  retryAfterSec: number;
}

/**
 * Tính LUÔN một lượt rồi trả kết quả. Dùng cho hành động mà mọi lần gọi đều đáng
 * tính, ví dụ đăng ký tài khoản.
 *
 * Cửa sổ cố định (fixed window) — đơn giản, đủ dùng, không cần chính xác tuyệt đối.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    if (buckets.size > MAX_KEYS) sweepExpired(now);
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0 };
  }

  if (bucket.count >= limit) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  bucket.count += 1;
  return { ok: true, retryAfterSec: 0 };
}

// ── Biến thể cho ĐĂNG NHẬP ────────────────────────────────────────────────────
// Đăng nhập cần tách "kiểm tra" khỏi "tính lượt": chỉ lần nhập SAI mới đáng bị
// tính. Nếu tính cả lần đúng thì người dùng bình thường đăng nhập vài lần trong
// ngày cũng bị khoá, còn kẻ dò mật khẩu thì vẫn dò đủ số lần như nhau.

/** Kiểm tra đã vượt giới hạn chưa — KHÔNG tính thêm lượt nào. */
export function isRateLimited(key: string, limit: number): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt || bucket.count < limit) {
    return { ok: true, retryAfterSec: 0 };
  }
  return {
    ok: false,
    retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}

/** Ghi nhận một lần thất bại. */
export function recordFailure(key: string, windowMs: number): void {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    if (buckets.size > MAX_KEYS) sweepExpired(now);
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  bucket.count += 1;
}

/** Xoá bộ đếm — gọi khi thao tác thành công (vd đăng nhập đúng). */
export function resetRateLimit(key: string): void {
  buckets.delete(key);
}
