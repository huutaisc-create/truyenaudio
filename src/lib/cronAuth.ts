// src/lib/cronAuth.ts
// Kiểm tra bí mật cho các endpoint cron. FAIL-CLOSED: chưa cấu hình CRON_SECRET thì
// từ chối chạy (giống JWT_SECRET) — thiếu biến env mà vẫn cho chạy nghĩa là ai cũng
// gọi được endpoint xoá dữ liệu.
export function checkCronSecret(req: Request): boolean {
  const configured = process.env.CRON_SECRET;
  if (!configured) return false;

  const authHeader = req.headers.get('Authorization');
  if (authHeader === `Bearer ${configured}`) return true;

  // Cho phép ?secret= để tiện gọi thử bằng trình duyệt/curl không header.
  const { searchParams } = new URL(req.url);
  if (searchParams.get('secret') === configured) return true;

  return false;
}
