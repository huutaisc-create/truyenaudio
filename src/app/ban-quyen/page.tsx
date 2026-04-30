import Link from 'next/link';
import { Copyright, FileSearch, Clock, Mail, ArrowLeft, AlertCircle } from 'lucide-react';

export const metadata = { title: 'Liên hệ bản quyền – Mytruyenaudio' };

const steps = [
  {
    step: '01',
    icon: <AlertCircle size={20} className="text-[#e8580a]" />,
    title: 'Nguồn nội dung',
    content:
      'Các tác phẩm audio trên hệ thống được sưu tầm từ nhiều nguồn hoặc do cộng đồng đóng góp. Mytruyenaudio luôn tôn trọng quyền sở hữu trí tuệ của các tác giả và đơn vị sở hữu nội dung.',
  },
  {
    step: '02',
    icon: <FileSearch size={20} className="text-[#e8580a]" />,
    title: 'Gửi yêu cầu',
    content:
      'Nếu bạn tin rằng bất kỳ nội dung nào trên website vi phạm bản quyền của bạn, vui lòng gửi thông báo kèm bằng chứng chứng minh quyền sở hữu và liên kết đến nội dung bị cho là vi phạm.',
  },
  {
    step: '03',
    icon: <Clock size={20} className="text-[#e8580a]" />,
    title: 'Quy trình xử lý',
    content:
      'Khi nhận được yêu cầu hợp lệ, chúng tôi sẽ tiến hành rà soát và gỡ bỏ nội dung vi phạm trong vòng 24 đến 48 giờ làm việc.',
  },
];

export default function BanQuyenPage() {
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
              <Copyright size={24} className="text-[#e8580a]" />
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[.15em] text-[#e8580a] mb-1">Mytruyenaudio</p>
              <h1 className="text-2xl font-bold text-white">Liên hệ bản quyền</h1>
            </div>
          </div>
          <p className="text-[#8a7e72] text-sm leading-relaxed">
            Chúng tôi tôn trọng mọi quyền sở hữu trí tuệ. Nếu nội dung của bạn xuất hiện trên hệ thống mà chưa được phép, hãy liên hệ với chúng tôi để được xử lý nhanh chóng.
          </p>
        </div>
      </div>

      {/* Steps */}
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="flex flex-col gap-4 mb-10">
          {steps.map((s, i) => (
            <div key={i} className="rounded-2xl bg-[#141210] border border-white/[0.06] p-6 flex gap-5">
              <div className="shrink-0 flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-[#e8580a]/10 border border-[#e8580a]/20 flex items-center justify-center">
                  {s.icon}
                </div>
                <span className="text-[10px] font-black text-[#e8580a]/50 tracking-widest">{s.step}</span>
              </div>
              <div>
                <h2 className="text-[15px] font-bold text-white mb-2">{s.title}</h2>
                <p className="text-[14px] text-[#c0b4a8] leading-relaxed">{s.content}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Contact card */}
        <div className="rounded-2xl bg-gradient-to-br from-[#e8580a]/15 to-[#e8580a]/05 border border-[#e8580a]/30 p-8 flex flex-col items-center text-center gap-4">
          <div className="w-14 h-14 rounded-full bg-[#e8580a]/20 border border-[#e8580a]/40 flex items-center justify-center">
            <Mail size={26} className="text-[#e8580a]" />
          </div>
          <div>
            <h3 className="text-[16px] font-bold text-white mb-1">Gửi yêu cầu bản quyền</h3>
            <p className="text-[13px] text-[#8a7e72] mb-4">Vui lòng cung cấp bằng chứng sở hữu và đường dẫn nội dung vi phạm</p>
            <a
              href="mailto:admin-mytruyenaudio@gmail.com?subject=Yêu cầu gỡ nội dung vi phạm bản quyền"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#e8580a] hover:bg-[#ff7c35] text-white font-bold text-[14px] transition-colors"
            >
              <Mail size={16} />
              admin-mytruyenaudio@gmail.com
            </a>
          </div>
        </div>

        <p className="text-center text-[12px] text-[#8a7e72] pt-8 border-t border-white/[0.05] mt-8">
          Thời gian xử lý: 24–48 giờ làm việc · Cập nhật tháng 4 năm 2026
        </p>
      </div>
    </main>
  );
}
