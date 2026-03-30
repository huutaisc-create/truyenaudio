/**
 * Vietnam timezone helpers (UTC+7)
 * Dùng chung cho các route cần reset theo giờ Việt Nam (0h VN = UTC 17:00 hôm trước)
 */

const VN_OFFSET_MS = 7 * 3600 * 1000 // 7 tiếng

/**
 * Trả về Date tương ứng với 0h hôm nay theo giờ Việt Nam (dưới dạng UTC timestamp).
 * Ví dụ: 2h sáng VN ngày 31/3 → trả về 31/3 17:00 UTC ngày 30/3
 */
export function getVnTodayStart(): Date {
  const nowVN = Date.now() + VN_OFFSET_MS
  return new Date(Math.floor(nowVN / 86400000) * 86400000 - VN_OFFSET_MS)
}

/**
 * Số giây còn lại cho đến 0h ngày hôm sau theo giờ Việt Nam.
 */
export function secsUntilVnMidnight(): number {
  const nowVN = Date.now() + VN_OFFSET_MS
  const nextMidnightVN = (Math.floor(nowVN / 86400000) + 1) * 86400000
  return Math.ceil((nextMidnightVN - VN_OFFSET_MS - Date.now()) / 1000)
}
