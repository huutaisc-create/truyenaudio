# CLAUDE.md — webtruyen-app (Next.js backend + web)

Next.js (App Router) + Prisma + PostgreSQL. Phục vụ web + API cho app mobile (repo webtruyen_mobile).
API public qua `https://api.mytruyenaudio.com` (Cloudflare, SSL Flexible). Prod chạy trên VPS.

## ⚠️ QUY TẮC AN TOÀN KHI SỬA FILE (đọc trước MỌI lần chỉnh sửa)

1. **Re-stage trước khi sửa** file có thể đã đổi trong phiên → `device_stage_files` lại lấy bản mới nhất (nội dung + mtime), đọc lại, rồi mới sửa. Không đè lên bản staged cũ.
2. Commit luôn kèm `expectedMtimeMs`; bị từ chối vì mtime lệch → re-stage + gộp lại, KHÔNG force.
3. Thay thế chính xác (grep/xác minh count==1), không gõ lại cả file.
4. Sau mỗi đợt sửa → nhắc user commit git.

## ⚠️ PRISMA / DATABASE — CẢNH BÁO QUAN TRỌNG

- **DB đang có "drift"** (lịch sử migration KHÔNG khớp DB thật, do dự án quản bằng db push).
- **TUYỆT ĐỐI KHÔNG chạy `prisma migrate dev`** → nó đòi "reset schema = mất TOÀN BỘ data". Nếu nó hỏi reset → trả lời **N**.
- Thêm/sửa index hay schema trên DB thật: chạy **SQL trực tiếp** (psql) với `CREATE INDEX IF NOT EXISTS ...`, hoặc `prisma db push` cẩn thận. `schema.prisma` cứ khai báo `@@index` để đồng bộ, nhưng tạo index thật bằng SQL.
- **KHÔNG chạy/test ở local.** User chỉ làm việc trên VPS (prod). Mọi hướng dẫn chỉ đưa lệnh chạy trên VPS —
  không nhắc `npm run dev`, DB dev Neon, `.env.local`, hay bước chạy prisma ở máy local.
- DB prod (127.0.0.1 trên VPS) nằm trong `.env` — Prisma CLI đọc file này. (`.env.local` / DB dev Neon còn trong repo nhưng không dùng.)
- Dùng singleton `import db from '@/lib/db'`, KHÔNG `new PrismaClient()` mỗi route.

### Giải thích "drift" là gì, cho lần sau đọc lại (ghi 2026-09-16)

Prisma có 2 nguồn "sự thật" về cấu trúc DB: `schema.prisma` (mô tả bảng/cột muốn có) và
`prisma/migrations/` + bảng `_prisma_migrations` trong chính Postgres (lịch sử "đã chạy
migration nào"). Bình thường 2 thứ này phải khớp nhau.

Repo này chỉ có **đúng 1 migration chính thức**: `20260316225856_init` (3/2026). Mọi thay đổi
bảng từ đó tới giờ (`social-migration-2.sql` → `social-migration-8.sql`: chat, kênh bài đăng,
Report, UserBlock, `isAdult`, `ageConfirmed`...) đều chạy tay bằng `psql`, KHÔNG đi qua Prisma
migration. Đúng quy tắc an toàn (tránh mất data), nhưng hệ quả: `schema.prisma` mô tả DB có
hàng chục bảng/cột, còn `migrations/` + lịch sử trong DB thì vẫn tưởng chỉ có mỗi `init`. Đó là
"drift" — 2 nguồn lệch nhau rất xa.

Rủi ro cụ thể: `prisma migrate dev` so sánh migration history với schema hiện tại để tính phần
chênh cần áp thêm. Lệch nhiều như vậy nó không tự vá được → sẽ đòi RESET database (xoá sạch,
tạo lại từ migration history) để đồng bộ. Trên prod = mất trắng data. Đây là lý do tuyệt đối
không chạy `migrate dev`.

Lưu ý phụ: `npm run build` (dùng khi deploy) có sẵn bước `prisma migrate deploy` ở giữa
(`prisma generate && prisma migrate deploy && next build`). Lệnh này AN TOÀN hơn `migrate dev`
nhiều — không tự reset, chỉ áp migration còn thiếu trong `migrations/`. Vì thư mục đó chỉ có 1
file và đã đánh dấu "đã chạy" từ lâu nên hiện tại bước này chạy êm, không lỗi. Nhưng là bom hẹn
giờ nhẹ: nếu sau này có migration mới đúng chuẩn Prisma được thêm vào `migrations/`, `migrate
deploy` có thể phát hiện lịch sử không khớp DB thật và báo lỗi, làm gãy build/deploy.

**Cách xử lý đúng khi user sẵn sàng dọn (KHÔNG tự làm khi chưa được yêu cầu, và làm trên
backup trước):** "baseline" lại migration history — `prisma db pull` để Prisma đọc đúng cấu
trúc DB thật, tạo migration mới mô tả đúng hiện trạng, rồi đánh dấu đã áp dụng bằng `prisma
migrate resolve --applied <tên>` (KHÔNG chạy migration đó thật vì DB đã có sẵn rồi). Sau đó
lịch sử khớp thực tế, không đụng dữ liệu, và từ đó tạo migration mới bình thường được.

## Bảo mật / quy ước đã chốt

- **JWT_SECRET**: đã bỏ fallback hardcode trong code — BẮT BUỘC set trong env (dev `.env.local`, prod `.env` trên VPS), cùng giá trị. Thiếu là auth hỏng (fail-closed, có chủ đích).
- **Upload cover**: `/api/upload` nén bằng `sharp` → WebP; cover profile 800×1066 q80. `/api/admin/upload-image` KHÔNG nén (ghi thẳng /covers). Form admin dùng `/api/upload` với `type: 'cover'`.
- **Cloudflare**: domain trên Cloudflare (Free), SSL **Flexible**; ảnh `/api/uploads/*` cache HIT ở edge (SIN). Nâng Full(strict) để dành.
- **credits/add**: LỖ HỔNG — user đăng nhập gọi lặp là mint credit free (chưa verify ad SSV). CHƯA fix, để sau (xem api_security trong repo mobile).

## Deploy (production trên VPS)
```
# local
git add -A && git commit -m "..." && git push
# VPS
cd /var/www/truyenaudio && git pull && npm run build && pm2 restart truyenaudio
```
`npm run build` chạy `prisma generate && prisma migrate deploy && next build`. Restart để nạp env + code mới.
