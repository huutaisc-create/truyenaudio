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
- DB dev (Neon cloud) nằm trong `.env.local`; DB prod (127.0.0.1 trên VPS) trong `.env`. Prisma CLI chỉ đọc `.env`, không đọc `.env.local` → chạy prisma ở local cần nạp `DATABASE_URL` thủ công.
- Dùng singleton `import db from '@/lib/db'`, KHÔNG `new PrismaClient()` mỗi route.

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
