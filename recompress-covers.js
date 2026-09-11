/**
 * recompress-covers.js
 * Nén lại cover cũ trong thư mục uploads: resize <= 800x1066, WebP quality 80.
 * - Giữ NGUYÊN tên file (ghi đè), nên URL ảnh không đổi.
 * - BACKUP bản gốc trước khi ghi đè (thư mục cover_backup, ngoài public).
 * - Chỉ ghi đè nếu bản mới NHỎ HƠN >=3% (không phá ảnh đã tối ưu).
 * - Bỏ qua avatar-*.webp.
 *
 * Chạy trên VPS, trong thư mục project (để tìm được node_modules/sharp):
 *   cd /var/www/truyenaudio
 *   node recompress-covers.js
 *
 * Nếu đường dẫn khác, sửa UPLOAD_DIR bên dưới hoặc set env UPLOAD_STORAGE_DIR.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const UPLOAD_DIR = process.env.UPLOAD_STORAGE_DIR
  ? path.join(process.env.UPLOAD_STORAGE_DIR, 'uploads')
  : '/var/www/truyenaudio/public/uploads';

// Backup ra ngoài public (không bị web serve). Đổi nếu muốn.
const BACKUP_DIR = path.join(path.dirname(path.dirname(UPLOAD_DIR)), 'cover_backup');

const MAX_W = 800, MAX_H = 1066, QUALITY = 80;

(async () => {
  if (!fs.existsSync(UPLOAD_DIR)) {
    console.error('KHONG thay thu muc:', UPLOAD_DIR);
    process.exit(1);
  }
  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const files = fs.readdirSync(UPLOAD_DIR).filter(
    f => f.toLowerCase().endsWith('.webp') && !f.startsWith('avatar-')
  );
  console.log(`Tim thay ${files.length} file .webp (da bo qua avatar-*).`);
  console.log(`Backup vao: ${BACKUP_DIR}\n`);

  let changed = 0, skipped = 0, failed = 0, totalOld = 0, totalNew = 0;

  for (const f of files) {
    const src = path.join(UPLOAD_DIR, f);
    try {
      const input = fs.readFileSync(src);
      const oldSize = input.length;
      const output = await sharp(input)
        .resize(MAX_W, MAX_H, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: QUALITY })
        .toBuffer();

      if (output.length < oldSize * 0.97) {
        fs.copyFileSync(src, path.join(BACKUP_DIR, f)); // backup truoc
        fs.writeFileSync(src, output);                  // ghi de
        changed++; totalOld += oldSize; totalNew += output.length;
        console.log(`  ✓ ${f}: ${(oldSize/1024).toFixed(0)}KB -> ${(output.length/1024).toFixed(0)}KB`);
      } else {
        skipped++;
      }
    } catch (e) {
      failed++;
      console.error(`  ✗ Loi ${f}: ${e.message}`);
    }
  }

  console.log(`\n===== KET QUA =====`);
  console.log(`Da nen : ${changed} file`);
  console.log(`Bo qua : ${skipped} (da toi uu, khong nho hon)`);
  console.log(`Loi    : ${failed}`);
  if (changed) {
    console.log(`Dung luong: ${(totalOld/1024/1024).toFixed(1)}MB -> ${(totalNew/1024/1024).toFixed(1)}MB ` +
      `(giam ${((1 - totalNew/totalOld) * 100).toFixed(0)}%)`);
  }
  console.log(`Ban goc backup tai: ${BACKUP_DIR}`);
  console.log(`Kiem tra anh OK roi thi co the xoa thu muc backup de lay lai dung luong.`);
})();
