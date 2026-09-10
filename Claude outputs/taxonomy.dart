// lib/core/constants/taxonomy.dart
// Bảng chuẩn thể loại (7 nhóm) — MIRROR của src/lib/taxonomy.ts bên web.
// Thứ tự trong danh sách = thứ tự ưu tiên hiển thị (FACET_ORDER).

class Facet {
  final String type;   // khớp Genre.type trong DB, vd 'THE_GIOI'
  final String label;  // nhãn hiển thị, vd 'Thế Giới'
  final String param;  // query param, vd 'the-gioi'
  const Facet(this.type, this.label, this.param);
}

// Thứ tự ưu tiên: Thế Giới → Loại Hình → Giới Tính → Thị Giác → Bàn Tay Vàng → Nhân Thiết → Kết Thúc
const List<Facet> kFacets = [
  Facet('THE_GIOI', 'Thế Giới', 'the-gioi'),
  Facet('LOAI_HINH', 'Loại Hình', 'loai-hinh'),
  Facet('GIOI_TINH', 'Giới Tính', 'gioi-tinh'),
  Facet('THI_GIAC', 'Thị Giác Tác Phẩm', 'thi-giac'),
  Facet('BAN_TAY_VANG', 'Bàn Tay Vàng', 'ban-tay-vang'),
  Facet('NHAN_THIET', 'Nhân Thiết Main', 'nhan-thiet'),
  Facet('KET_THUC', 'Kết Thúc', 'ket-thuc'),
];
