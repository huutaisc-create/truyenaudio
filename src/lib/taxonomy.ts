// src/lib/taxonomy.ts
// NGUỒN CHÂN LÝ DUY NHẤT cho tag/thể loại.
// Dùng cho: form tạo/sửa truyện, bộ lọc /tim-kiem, nút "Tìm và thêm", migration dọn DB.
// Cách 1 (alias để trong code). Muốn dạy thêm cách viết mới → thêm vào ALIASES rồi deploy.

export type FacetType = 'GENRE' | 'BOI_CANH' | 'LUU_PHAI' | 'TINH_CACH' | 'THI_GIAC';

// Nhãn hiển thị của từng facet trên UI
export const FACET_LABEL: Record<FacetType, string> = {
  GENRE:     'Thể Loại',
  BOI_CANH:  'Bối Cảnh',
  LUU_PHAI:  'Lưu Phái',
  TINH_CACH: 'Tính Cách',
  THI_GIAC:  'Thị Giác',
};

// Thứ tự hiển thị các facet
export const FACET_ORDER: FacetType[] = ['GENRE', 'BOI_CANH', 'LUU_PHAI', 'TINH_CACH', 'THI_GIAC'];

// ─────────────────────────────────────────────────────────────────────────────
// DANH SÁCH TAG CHUẨN theo từng facet.  ⟵ CHỖ BẠN DUYỆT CHÍNH.
// (Tên ở đây là tên hiển thị chuẩn; cách viết lệch dấu/hoa-thường tự khớp, không cần khai báo.)
// ─────────────────────────────────────────────────────────────────────────────
export const TAXONOMY: Record<FacetType, string[]> = {
  // Thể loại + các trope (Nữ Phụ, Pháo Hôi, Nghịch Tập, HE... gộp vào đây theo yêu cầu)
  GENRE: [
    'Ngôn Tình', 'Tình Cảm', 'Đam Mỹ', 'Bách Hợp',
    'Tiên Hiệp', 'Huyền Huyễn', 'Khoa Huyễn', 'Kỳ Ảo',
    'Võ Hiệp', 'Kiếm Hiệp', 'Đô Thị', 'Đồng Nhân',
    'Dã Sử', 'Lịch Sử', 'Quân Sự', 'Quan Trường',
    'Huyền Nghi', 'Trinh Thám', 'Thám Hiểm', 'Linh Dị',
    'Mạt Thế', 'Cung Đấu', 'Gia Đấu', 'Điền Văn',
    'Hài Hước', 'Võng Du', 'Cạnh Kỹ', 'Light Novel', 'Việt Nam',
    'Sắc', 'Ngược', 'Sủng', 'Nữ Cường',
    // Xuyên/trọng sinh giữ ở Thể loại (khớp quick-chip app) + Niên Đại
    'Xuyên Không', 'Xuyên Nhanh', 'Xuyên Qua', 'Trọng Sinh', 'Niên Đại',
    // Trope (theo yêu cầu: dồn vào Thể loại)
    'Nữ Phụ', 'Pháo Hôi', 'Nghịch Tập', 'HE', 'BE', 'Sảng Văn', 'Ngọt Sủng',
  ],

  // Bối cảnh / thời không
  BOI_CANH: [
    'Cổ Đại', 'Hiện Đại', 'Cận Đại', 'Tương Lai',
    'Dị Giới', 'Đông Phương', 'Tây Phương', 'Huyền Ảo',
    'Xuyên Việt', 'Giả Tưởng Lịch Sử',
  ],

  // Lưu phái / thủ pháp / mô-típ nền
  LUU_PHAI: [
    'Hệ Thống',
    'Tùy Thân', 'Hào Môn Thế Gia', 'Cung Đình Hầu Tước', 'Tu Chân',
    'Vô Địch', 'Cực Phẩm', 'Niên Thượng', 'Song Trọng Sinh',
    'Làm Ruộng', 'Mỹ Thực', 'Nhạc Lý', 'Lão Gia', 'Bàn Thờ',
    'Giang Hồ Ân Oán', 'Hình Tượng Văn', 'Làm Giàu',
  ],

  // Tính cách nhân vật chính
  TINH_CACH: [
    'Điềm Đạm', 'Nhiệt Huyết', 'Vô Sỉ', 'Thiết Huyết',
    'Nhẹ Nhàng', 'Cơ Trí', 'Lãnh Khốc', 'Kiêu Ngạo', 'Ngây Thơ',
  ],

  // Thị giác kể chuyện
  THI_GIAC: [
    'Thị giác nữ chủ', 'Thị giác nam chủ', 'Ngôi thứ nhất',
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// ALIAS: các cách viết khác NGHĨA GIỐNG nhưng CHỮ khác (lệch dấu/hoa-thường KHÔNG cần khai ở đây).
// key = tag chuẩn, value = các biến thể nguồn hay gặp.
// ─────────────────────────────────────────────────────────────────────────────
export const ALIASES: Record<string, string[]> = {
  'Thị giác nữ chủ': ['Nữ chủ', 'Góc nhìn nữ chính', 'Nữ chính'],
  'Thị giác nam chủ': ['Nam chủ', 'Góc nhìn nam chính', 'Nam chính'],
  'Ngôi thứ nhất':    ['Ngôi 1'],
  'Tình Cảm':         ['Romance'],
  'HE':               ['Happy Ending', 'Kết thúc HE'],
  'BE':               ['Bad Ending', 'Kết thúc BE'],
  'Xuyên Việt':       ['Xuyên qua thời gian'],
  'Nữ Cường':         ['Nữ mạnh'],
};

// ─────────────────────────────────────────────────────────────────────────────
// DENYLIST: token KHÔNG phải tag → bỏ im lặng (không đưa vào "chưa nhận diện").
// (Huy hiệu, đề cử, và loại-truyện vì đã có trường Loại riêng.)
// ─────────────────────────────────────────────────────────────────────────────
export const DENYLIST: string[] = [
  'Kim bài đề cử', 'Đề cử', 'Bạc đề cử', 'Đồng đề cử',
  'Nguyên sang', 'Convert', 'Dịch', 'Bản dịch',
  'VIP', 'Hoàn thành', 'Còn tiếp',
];

// ═════════════════════════════════════════════════════════════════════════════
// LOGIC KHỚP — dùng chung cho nút "Tìm và thêm" và migration.
// ═════════════════════════════════════════════════════════════════════════════

/** Chuẩn hoá về "khoá so khớp": bỏ dấu, đ→d, thường hoá, bỏ emoji/ký tự lạ, gộp khoảng trắng. */
export function normKey(s: string): string {
  return s
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

type Entry = { name: string; type: FacetType };

// Chỉ mục normKey → {name,type}, dựng 1 lần.
const INDEX: Map<string, Entry> = (() => {
  const m = new Map<string, Entry>();
  (Object.keys(TAXONOMY) as FacetType[]).forEach(type => {
    TAXONOMY[type].forEach(name => m.set(normKey(name), { name, type }));
  });
  // alias trỏ về tag chuẩn (tìm tag chuẩn thuộc facet nào)
  Object.entries(ALIASES).forEach(([canonical, variants]) => {
    const canonKey = normKey(canonical);
    const target = m.get(canonKey);
    if (target) variants.forEach(v => m.set(normKey(v), target));
  });
  return m;
})();

const DENY = new Set(DENYLIST.map(normKey));

export type ClassifyResult = {
  matched: Entry[];      // các tag khớp (đã bỏ trùng)
  unmatched: string[];   // token không nhận diện (giữ nguyên chữ gốc để admin xem)
  ignored: string[];     // token bị bỏ theo denylist (huy hiệu, loại truyện...)
};

/** Tách chuỗi meta thô → phân loại. Ngăn cách: dấu phẩy, chấm phẩy, gạch đứng, xuống dòng, "·". */
export function classifyTokens(raw: string): ClassifyResult {
  const tokens = raw.split(/[,;|\n·]+/).map(t => t.trim()).filter(Boolean);
  const matched: Entry[] = [];
  const seen = new Set<string>();
  const unmatched: string[] = [];
  const ignored: string[] = [];

  for (const tok of tokens) {
    const k = normKey(tok);
    if (!k) continue;
    if (DENY.has(k)) { ignored.push(tok); continue; }
    const hit = INDEX.get(k);
    if (hit) {
      const id = hit.type + ':' + hit.name;
      if (!seen.has(id)) { seen.add(id); matched.push(hit); }
    } else {
      unmatched.push(tok);
    }
  }
  return { matched, unmatched, ignored };
}
