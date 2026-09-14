import Link from 'next/link';
import { Lock, UserCheck, Cookie, Database, ArrowLeft, Smartphone, Share2, Trash2, Baby, Clock } from 'lucide-react';

export const metadata = {
  title: 'Chính sách bảo mật – Mytruyenaudio',
  description:
    'Chính sách bảo mật của website và ứng dụng MyTruyenAudio: dữ liệu thu thập, mục đích sử dụng, chia sẻ, lưu trữ và quyền xoá dữ liệu.',
};

const LAST_UPDATED = '14 tháng 9 năm 2026';
const CONTACT = 'admin-mytruyenaudio@gmail.com';

const sections = [
  {
    icon: <Smartphone size={22} className="text-[#e8580a]" />,
    title: 'Phạm vi áp dụng',
    body: [
      'Chính sách này áp dụng cho website Mytruyenaudio và ứng dụng di động MyTruyenAudio trên Android (package com.webtruyen.webtruyen_mobile), do HTH Studio phát hành.',
      'Bằng việc sử dụng website hoặc ứng dụng, bạn đồng ý với các điều khoản mô tả dưới đây.',
    ],
  },
  {
    icon: <Database size={22} className="text-[#e8580a]" />,
    title: 'Dữ liệu chúng tôi thu thập',
    body: [
      'Thông tin tài khoản: địa chỉ email, tên hiển thị và ảnh đại diện. Nếu bạn đăng nhập bằng Google, chúng tôi nhận các thông tin này từ tài khoản Google của bạn; chúng tôi KHÔNG nhận mật khẩu Google. Nếu bạn đăng ký bằng email, mật khẩu được mã hoá một chiều (bcrypt) trước khi lưu.',
      'Hoạt động trong ứng dụng: lịch sử đọc và nghe, tủ sách, bình luận, lượt thích, tin nhắn trong phòng trò chuyện, số chương đã đọc và điểm thưởng.',
      'Mã thông báo đẩy: một mã định danh do Firebase Cloud Messaging cấp cho bản cài đặt ứng dụng trên thiết bị của bạn, dùng để gửi thông báo.',
      'Dữ liệu kỹ thuật: nhật ký máy chủ (địa chỉ IP, thời điểm truy cập) phục vụ vận hành và chống lạm dụng.',
      'Ứng dụng KHÔNG thu thập danh bạ, tin nhắn SMS, vị trí chính xác, ảnh trong máy (trừ ảnh bạn chủ động chọn làm ảnh đại diện) hay danh sách ứng dụng đã cài.',
    ],
  },
  {
    icon: <UserCheck size={22} className="text-[#e8580a]" />,
    title: 'Mục đích sử dụng',
    body: [
      'Tạo và quản lý tài khoản, xác thực đăng nhập.',
      'Đồng bộ tủ sách và lịch sử đọc giữa các thiết bị.',
      'Gửi thông báo về chương mới, trả lời bình luận và hoạt động trong phòng trò chuyện.',
      'Vận hành hệ thống điểm thưởng và tải truyện ngoại tuyến.',
      'Phát hiện và ngăn chặn hành vi lạm dụng, gian lận.',
    ],
  },
  {
    icon: <Share2 size={22} className="text-[#e8580a]" />,
    title: 'Chia sẻ dữ liệu',
    body: [
      'Chúng tôi KHÔNG bán dữ liệu cá nhân của bạn cho bất kỳ bên nào.',
      'Chúng tôi sử dụng Google Firebase (Authentication, Cloud Messaging) để đăng nhập và gửi thông báo. Dữ liệu xử lý bởi dịch vụ này tuân theo chính sách bảo mật của Google.',
      'Chúng tôi chỉ tiết lộ dữ liệu khi có yêu cầu hợp pháp từ cơ quan nhà nước có thẩm quyền.',
      'Phiên bản hiện tại của ứng dụng KHÔNG hiển thị quảng cáo và KHÔNG sử dụng mã định danh quảng cáo (Advertising ID).',
    ],
  },
  {
    icon: <Lock size={22} className="text-[#e8580a]" />,
    title: 'Bảo mật',
    body: [
      'Toàn bộ dữ liệu truyền giữa ứng dụng và máy chủ được mã hoá qua HTTPS/TLS.',
      'Mật khẩu được băm bằng bcrypt, không lưu dưới dạng văn bản thô và không ai — kể cả quản trị viên — đọc được.',
      'Phiên đăng nhập dùng JWT có thời hạn; bạn có thể đăng xuất bất kỳ lúc nào để thu hồi phiên trên thiết bị.',
    ],
  },
  {
    icon: <Clock size={22} className="text-[#e8580a]" />,
    title: 'Thời gian lưu trữ',
    body: [
      'Dữ liệu tài khoản được lưu trong suốt thời gian tài khoản còn hoạt động.',
      'Khi bạn xoá tài khoản, toàn bộ dữ liệu gắn với tài khoản bị xoá khỏi cơ sở dữ liệu ngay lập tức. Bản sao lưu định kỳ có thể còn lưu dữ liệu tối đa 30 ngày trước khi bị ghi đè.',
      'Nhật ký máy chủ ẩn danh được giữ tối đa 90 ngày.',
    ],
  },
  {
    icon: <Trash2 size={22} className="text-[#e8580a]" />,
    title: 'Quyền của bạn — xem, sửa và xoá dữ liệu',
    body: [
      'Xem và sửa: mở mục Cá Nhân trong ứng dụng để xem hoặc chỉnh sửa tên, ảnh đại diện và mật khẩu.',
      'Xoá tài khoản trong ứng dụng: Cá Nhân → Tài khoản → Xoá tài khoản. Thao tác này xoá vĩnh viễn tài khoản cùng toàn bộ dữ liệu liên quan và không thể hoàn tác.',
      'Xoá tài khoản không cần cài ứng dụng: xem hướng dẫn tại trang Yêu cầu xoá tài khoản.',
      `Mọi thắc mắc về dữ liệu cá nhân, liên hệ ${CONTACT}.`,
    ],
  },
  {
    icon: <Baby size={22} className="text-[#e8580a]" />,
    title: 'Trẻ em',
    body: [
      'Dịch vụ không hướng tới trẻ em dưới 13 tuổi và chúng tôi không cố ý thu thập dữ liệu của trẻ em dưới 13 tuổi.',
      `Nếu bạn là phụ huynh và phát hiện con mình đã cung cấp dữ liệu cho chúng tôi, vui lòng liên hệ ${CONTACT} để chúng tôi xoá.`,
    ],
  },
  {
    icon: <Cookie size={22} className="text-[#e8580a]" />,
    title: 'Cookies (chỉ áp dụng cho website)',
    body: [
      'Website sử dụng cookies để ghi nhớ phiên đăng nhập và tuỳ chọn hiển thị của bạn, đồng thời đo hiệu quả hiển thị của đối tác quảng cáo (Google AdSense).',
      'Ứng dụng di động không sử dụng cookies.',
    ],
  },
];

export default function ChinhSachPage() {
  return (
    <main className="min-h-screen bg-[#0a0806] text-[#f0ebe4]">
      {/* Hero */}
      <div className="border-b border-white/[0.06] bg-[#0f0d0a]">
        <div className="max-w-3xl mx-auto px-6 py-14">
          <Link href="/" className="inline-flex items-center gap-2 text-[#8a7e72] hover:text-[#e8580a] transition-colors text-sm mb-8">
            <ArrowLeft size={15} /> Về trang chủ
          </Link>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-[#e8580a]/15 border border-[#e8580a]/30 flex items-center justify-center">
              <Lock size={24} className="text-[#e8580a]" />
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[.15em] text-[#e8580a] mb-1">Mytruyenaudio</p>
              <h1 className="text-2xl font-bold text-white">Chính sách bảo mật</h1>
            </div>
          </div>
          <p className="text-[#8a7e72] text-sm leading-relaxed">
            Áp dụng cho website Mytruyenaudio và ứng dụng di động MyTruyenAudio. Chính sách này mô tả dữ liệu
            chúng tôi thu thập, cách sử dụng, chia sẻ và cách bạn xoá dữ liệu của mình.
          </p>
          <p className="text-[#6d6359] text-xs mt-3">Cập nhật lần cuối: {LAST_UPDATED}</p>
        </div>
      </div>

      {/* Sections */}
      <div className="max-w-3xl mx-auto px-6 py-12 flex flex-col gap-6">
        {sections.map((s, i) => (
          <section key={i} className="rounded-2xl bg-[#141210] border border-white/[0.06] p-6 flex gap-5">
            <div className="shrink-0 w-10 h-10 rounded-xl bg-[#e8580a]/10 border border-[#e8580a]/20 flex items-center justify-center mt-0.5">
              {s.icon}
            </div>
            <div className="min-w-0">
              <h2 className="text-[15px] font-bold text-white mb-3">{s.title}</h2>
              <ul className="flex flex-col gap-2.5">
                {s.body.map((p, j) => (
                  <li key={j} className="text-[14px] text-[#c0b4a8] leading-relaxed flex gap-2.5">
                    <span className="text-[#e8580a] shrink-0 mt-[7px] w-1 h-1 rounded-full bg-[#e8580a]" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ))}

        <div className="rounded-2xl bg-[#e8580a]/[0.07] border border-[#e8580a]/25 p-6">
          <h2 className="text-[15px] font-bold text-white mb-2">Muốn xoá tài khoản?</h2>
          <p className="text-[14px] text-[#c0b4a8] leading-relaxed mb-4">
            Bạn có thể tự xoá ngay trong ứng dụng, hoặc gửi yêu cầu qua trang dành riêng nếu không còn cài ứng dụng.
          </p>
          <Link
            href="/xoa-tai-khoan"
            className="inline-flex items-center gap-2 rounded-xl bg-[#e8580a] px-4 py-2.5 text-[13px] font-bold text-white hover:bg-[#d24f08] transition-colors"
          >
            <Trash2 size={15} /> Hướng dẫn xoá tài khoản
          </Link>
        </div>

        <p className="text-center text-[12px] text-[#8a7e72] pt-4 border-t border-white/[0.05]">
          Cập nhật lần cuối: {LAST_UPDATED} ·{' '}
          <a href={`mailto:${CONTACT}`} className="text-[#e8580a] hover:underline">{CONTACT}</a>
        </p>
      </div>
    </main>
  );
}
