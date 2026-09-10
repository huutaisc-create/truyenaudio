// src/lib/taxonomy.ts
// NGUỒN CHÂN LÝ DUY NHẤT cho tag/thể loại — BẢNG CHUẨN MỚI (7 nhóm) theo yêu cầu.
// Dùng cho: form tạo/sửa truyện, bộ lọc /tim-kiem, app, nút "Tìm và thêm", migration.
// Alias để trong code (Cách 1). Lệch dấu/hoa-thường tự khớp, không cần khai báo alias.

export type FacetType =
  | 'THE_GIOI'      // Thế giới
  | 'THI_GIAC'      // Thị giác tác phẩm
  | 'GIOI_TINH'     // Giới tính
  | 'LOAI_HINH'     // Loại hình
  | 'BAN_TAY_VANG'  // Bàn tay vàng
  | 'NHAN_THIET'    // Nhân thiết main
  | 'KET_THUC';     // Kết thúc

// Nhãn hiển thị của từng nhóm
export const FACET_LABEL: Record<FacetType, string> = {
  THE_GIOI:     'Thế Giới',
  THI_GIAC:     'Thị Giác Tác Phẩm',
  GIOI_TINH:    'Giới Tính',
  LOAI_HINH:    'Loại Hình',
  BAN_TAY_VANG: 'Bàn Tay Vàng',
  NHAN_THIET:   'Nhân Thiết Main',
  KET_THUC:     'Kết Thúc',
};

// Thứ tự ưu tiên hiển thị (dùng cho sắp xếp nhóm + ưu tiên tag trên thẻ truyện)
export const FACET_ORDER: FacetType[] = [
  'THE_GIOI', 'LOAI_HINH', 'GIOI_TINH', 'THI_GIAC', 'BAN_TAY_VANG', 'NHAN_THIET', 'KET_THUC',
];

// Param URL / query cho mỗi nhóm (dùng chung cho link chip + /tim-kiem + /api/search)
export const FACET_PARAM: Record<FacetType, string> = {
  THE_GIOI:     'the-gioi',
  THI_GIAC:     'thi-giac',
  GIOI_TINH:    'gioi-tinh',
  LOAI_HINH:    'loai-hinh',
  BAN_TAY_VANG: 'ban-tay-vang',
  NHAN_THIET:   'nhan-thiet',
  KET_THUC:     'ket-thuc',
};

// ─────────────────────────────────────────────────────────────────────────────
// DANH SÁCH TAG CHUẨN theo từng nhóm (đã viết Hoa chữ cái đầu).  ⟵ CHỖ DUYỆT CHÍNH
// ─────────────────────────────────────────────────────────────────────────────
export const TAXONOMY: Record<FacetType, string[]> = {
  THE_GIOI: [
    'Cổ Đại', 'Niên Đại', 'Hiện Đại', 'Tương Lai', 'Mạt Thế',
    'Tu Tiên', 'Đồng Nhân', 'Võ Hiệp', 'Thú Thế', 'Xuyên Nhanh',
  ],
  THI_GIAC: [
    'Thị Giác Nam Chủ', 'Thị Giác Nữ Chủ', 'Chủ Công', 'Chủ Thụ',
  ],
  GIOI_TINH: [
    'Ngôn Tình', 'Nam Sinh', 'Đam Mỹ', 'Bách Hợp', 'Nữ Tôn',
    'Không CP', 'Đa Nguyên', '1v1', 'NP',
  ],
  LOAI_HINH: [
    'Tình Cảm', 'Làm Sự Nghiệp', 'Sinh Tồn', 'Tranh Bá', 'Trinh Thám',
    'Kinh Dị', 'Quan Trường', 'Quân Sự', 'Làm Ruộng', 'Cung Đấu',
    'Gia Đấu', 'Ngọt Sủng', 'Ngược Văn', 'Cẩu Huyết', 'Chữa Lành',
  ],
  BAN_TAY_VANG: [
    'Tùy Thân Không Gian', 'Hệ Thống', 'Đọc Tâm', 'Đánh Dấu',
    'Xuyên Không', 'Xuyên Thư', 'Xuyên Game', 'Trọng Sinh',
  ],
  NHAN_THIET: [
    'Nữ Cường', 'Tra Nữ', 'Tra Nam', 'Trà Xanh', 'Vạn Nhân Mê',
    'Hài Hước', 'Mary Sue',
  ],
  KET_THUC: [
    'HE', 'SE', 'OE',
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// ALIAS: cách viết khác NGHĨA GIỐNG (chữ khác). Lệch dấu/hoa-thường KHÔNG cần khai.
// ─────────────────────────────────────────────────────────────────────────────
export const ALIASES: Record<string, string[]> = {
  'Thị Giác Nữ Chủ':      ['Nữ chủ', 'Góc nhìn nữ chính', 'Nữ chính'],
  'Thị Giác Nam Chủ':     ['Nam chủ', 'Góc nhìn nam chính', 'Nam chính'],
  'Tu Tiên':              ['Tiên Hiệp', 'Tu chân'],
  'Ngọt Sủng':            ['Sủng', 'Ngọt'],
  'Ngược Văn':            ['Ngược'],
  'Tùy Thân Không Gian':  ['Tùy Thân', 'Không gian tùy thân'],
  'Mary Sue':             ['Mary Sure', 'Marysue', 'Mary sue'],
  'Không CP':             ['No CP', 'Vô CP'],
  'HE':                   ['Happy Ending', 'Kết HE'],
  'SE':                   ['Sad Ending', 'Kết SE'],
  'OE':                   ['Open Ending', 'Kết OE'],
};

// ─────────────────────────────────────────────────────────────────────────────
// DENYLIST: token KHÔNG phải tag → bỏ im lặng.
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

// Thứ hạng ưu tiên của mỗi nhóm (để sắp tag trên thẻ truyện theo FACET_ORDER).
const FACET_RANK: Record<string, number> =
  Object.fromEntries(FACET_ORDER.map((t, i) => [t, i]));

/** Sắp xếp tag của 1 truyện theo thứ tự ưu tiên nhóm rồi lấy `take` tag đầu (mặc định 3). */
export function orderGenreNames(
  genres: { name: string; type: string }[],
  take = 3,
): string[] {
  return genres
    .slice()
    .sort((a, b) => (FACET_RANK[a.type] ?? 99) - (FACET_RANK[b.type] ?? 99))
    .map(g => g.name)
    .slice(0, take);
}

type Entry = { name: string; type: FacetType };

const INDEX: Map<string, Entry> = (() => {
  const m = new Map<string, Entry>();
  (Object.keys(TAXONOMY) as FacetType[]).forEach(type => {
    TAXONOMY[type].forEach(name => m.set(normKey(name), { name, type }));
  });
  Object.entries(ALIASES).forEach(([canonical, variants]) => {
    const target = m.get(normKey(canonical));
    if (target) variants.forEach(v => m.set(normKey(v), target));
  });
  return m;
})();

const DENY = new Set(DENYLIST.map(normKey));

export type ClassifyResult = {
  matched: Entry[];
  unmatched: string[];
  ignored: string[];
};

/** Tách chuỗi meta thô → phân loại. Ngăn cách: phẩy, chấm phẩy, gạch đứng, xuống dòng, "·". */
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
