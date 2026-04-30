import Link from 'next/link';
import { Lock, UserCheck, Cookie, Database, ArrowLeft } from 'lucide-react';

export const metadata = { title: 'Chính sách bảo mật – Mytruyenaudio' };

const sections = [
  {
    icon: <Database size={22} className="text-[#e8580a]" />,
    title: 'Thông tin thu thập',
    content:
      'Chúng tôi lưu trữ thông tin khi bạn đăng ký tài khoản cho mục đích tạo profile cá nhân và tích lũy credit cho bạn. Chúng tôi không thu thập thông tin nhạy cảm ngoài phạm vi cần thiết.',
  },
  {
    icon: <UserCheck size={22} className="text-[#e8580a]" />,
    title: 'Mục đích sử dụng',
    content:
      'Thông tin được dùng để quản lý tài khoản, cá nhân hóa trải nghiệm người dùng, xử lý hệ thống điểm thưởng và gửi thông báo về các chương truyện mới. Chúng tôi không bán thông tin cá nhân của bạn cho bên thứ ba.',
  },
  {
    icon: <Cookie size={22} className="text-[#e8580a]" />,
    title: 'Sử dụng Cookies',
    content:
      'Website sử dụng cookies để lưu trữ tùy chọn của người dùng và theo dõi hiệu quả hiển thị của các đối tác quảng cáo (như Google AdSense). Điều này giúp tối ưu hóa nội dung hiển thị cho bạn.',
  },
  {
    icon: <Lock size={22} className="text-[#e8580a]" />,
    title: 'Bảo mật dữ liệu',
    content:
      'Chúng tôi áp dụng các biện pháp kỹ thuật tiên tiến nhất để ngăn chặn việc truy cập trái phép hoặc rò rỉ thông tin cá nhân của người dùng. Mật khẩu được mã hóa và không được lưu dưới dạng văn bản thô.',
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
            Chúng tôi tôn trọng và cam kết bảo vệ thông tin cá nhân của người dùng. Chính sách này mô tả cách chúng tôi thu thập và sử dụng dữ liệu của bạn.
          </p>
        </div>
      </div>

      {/* Sections */}
      <div className="max-w-3xl mx-auto px-6 py-12 flex flex-col gap-6">
        {sections.map((s, i) => (
          <div key={i} className="rounded-2xl bg-[#141210] border border-white/[0.06] p-6 flex gap-5">
            <div className="shrink-0 w-10 h-10 rounded-xl bg-[#e8580a]/10 border border-[#e8580a]/20 flex items-center justify-center mt-0.5">
              {s.icon}
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-white mb-2">{s.title}</h2>
              <p className="text-[14px] text-[#c0b4a8] leading-relaxed">{s.content}</p>
            </div>
          </div>
        ))}

        <p className="text-center text-[12px] text-[#8a7e72] pt-4 border-t border-white/[0.05]">
          Cập nhật lần cuối: tháng 4 năm 2026 · <a href="mailto:admin-mytruyenaudio@gmail.com" className="text-[#e8580a] hover:underline">admin-mytruyenaudio@gmail.com</a>
        </p>
      </div>
    </main>
  );
}
