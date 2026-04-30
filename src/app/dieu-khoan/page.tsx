import Link from 'next/link';
import { Scale, ShieldCheck, AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';

export const metadata = { title: 'Điều khoản dịch vụ – Mytruyenaudio' };

const sections = [
  {
    icon: <Scale size={22} className="text-[#e8580a]" />,
    title: 'Quyền sử dụng',
    content:
      'Website cung cấp nội dung audio truyện trực tuyến cho mục đích giải trí cá nhân. Bạn không được phép sao chép, phân phối hoặc sử dụng nội dung cho mục đích thương mại khi chưa có sự đồng ý bằng văn bản từ chúng tôi.',
  },
  {
    icon: <ShieldCheck size={22} className="text-[#e8580a]" />,
    title: 'Hành vi người dùng',
    content:
      'Người dùng có trách nhiệm bảo mật thông tin tài khoản và chịu trách nhiệm về mọi hoạt động diễn ra dưới tài khoản của mình. Không được có các hành vi gây cản trở hoặc phá hoại hệ thống kỹ thuật của website.',
  },
  {
    icon: <RefreshCw size={22} className="text-[#e8580a]" />,
    title: 'Thay đổi dịch vụ',
    content:
      'Chúng tôi có quyền điều chỉnh, tạm dừng hoặc chấm dứt bất kỳ phần nào của dịch vụ mà không cần thông báo trước để nâng cấp hệ thống hoặc đảm bảo an ninh mạng.',
  },
  {
    icon: <AlertTriangle size={22} className="text-[#e8580a]" />,
    title: 'Từ chối trách nhiệm',
    content:
      'Chúng tôi nỗ lực cung cấp trải nghiệm tốt nhất nhưng không đảm bảo rằng dịch vụ sẽ không bị gián đoạn do lỗi kỹ thuật hoặc sự cố ngoài ý muốn.',
  },
];

export default function DieuKhoanPage() {
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
              <Scale size={24} className="text-[#e8580a]" />
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[.15em] text-[#e8580a] mb-1">Mytruyenaudio</p>
              <h1 className="text-2xl font-bold text-white">Điều khoản dịch vụ</h1>
            </div>
          </div>
          <p className="text-[#8a7e72] text-sm leading-relaxed">
            Bằng việc truy cập và sử dụng dịch vụ trên trang web, bạn đồng ý tuân thủ các điều khoản sau đây. Vui lòng đọc kỹ trước khi sử dụng.
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
