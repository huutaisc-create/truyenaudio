import Link from 'next/link';
import { ArrowLeft, Trash2, Smartphone, Mail, AlertTriangle, ListChecks } from 'lucide-react';

export const metadata = {
  title: 'Yêu cầu xoá tài khoản – MyTruyenAudio',
  description:
    'Hướng dẫn xoá vĩnh viễn tài khoản MyTruyenAudio và toàn bộ dữ liệu liên quan, trực tiếp trong ứng dụng hoặc qua email.',
};

const CONTACT = 'admin-mytruyenaudio@gmail.com';
const APP_NAME = 'MyTruyenAudio';
const PACKAGE = 'com.webtruyen.webtruyen_mobile';

const deleted = [
  'Tài khoản, email, tên hiển thị và ảnh đại diện',
  'Tủ sách và lịch sử đọc / nghe',
  'Bình luận, đánh giá, lượt thích và bài đăng',
  'Tin nhắn trong phòng trò chuyện',
  'Điểm thưởng, credit và lịch sử giao dịch',
  'Mã thông báo đẩy của mọi thiết bị đã đăng nhập',
];

export default function XoaTaiKhoanPage() {
  return (
    <main className="min-h-screen bg-[#0a0806] text-[#f0ebe4]">
      <div className="border-b border-white/[0.06] bg-[#0f0d0a]">
        <div className="max-w-3xl mx-auto px-6 py-14">
          <Link href="/" className="inline-flex items-center gap-2 text-[#8a7e72] hover:text-[#e8580a] transition-colors text-sm mb-8">
            <ArrowLeft size={15} /> Về trang chủ
          </Link>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-[#e8580a]/15 border border-[#e8580a]/30 flex items-center justify-center">
              <Trash2 size={24} className="text-[#e8580a]" />
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[.15em] text-[#e8580a] mb-1">{APP_NAME}</p>
              <h1 className="text-2xl font-bold text-white">Yêu cầu xoá tài khoản</h1>
            </div>
          </div>
          <p className="text-[#8a7e72] text-sm leading-relaxed">
            Trang này hướng dẫn cách xoá vĩnh viễn tài khoản {APP_NAME} ({PACKAGE}) cùng toàn bộ dữ liệu
            liên quan. Bạn có thể tự thực hiện trong ứng dụng, hoặc gửi yêu cầu qua email nếu đã gỡ ứng dụng.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-12 flex flex-col gap-6">
        {/* Cách 1 */}
        <section className="rounded-2xl bg-[#141210] border border-white/[0.06] p-6 flex gap-5">
          <div className="shrink-0 w-10 h-10 rounded-xl bg-[#e8580a]/10 border border-[#e8580a]/20 flex items-center justify-center mt-0.5">
            <Smartphone size={22} className="text-[#e8580a]" />
          </div>
          <div className="min-w-0">
            <h2 className="text-[15px] font-bold text-white mb-1">Cách 1 — Xoá trong ứng dụng (nhanh nhất)</h2>
            <p className="text-[13px] text-[#8a7e72] mb-4">Có hiệu lực ngay lập tức, không cần chờ duyệt.</p>
            <ol className="flex flex-col gap-2.5">
              {[
                'Mở ứng dụng MyTruyenAudio và đăng nhập tài khoản cần xoá',
                'Vào tab Cá Nhân',
                'Kéo xuống mục TÀI KHOẢN → chọn Xoá tài khoản',
                'Gõ chính xác XOA TAI KHOAN để xác nhận, rồi bấm Xoá vĩnh viễn',
              ].map((step, i) => (
                <li key={i} className="text-[14px] text-[#c0b4a8] leading-relaxed flex gap-3">
                  <span className="shrink-0 w-5 h-5 rounded-md bg-[#e8580a]/15 border border-[#e8580a]/30 text-[11px] font-bold text-[#e8580a] flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Cách 2 */}
        <section className="rounded-2xl bg-[#141210] border border-white/[0.06] p-6 flex gap-5">
          <div className="shrink-0 w-10 h-10 rounded-xl bg-[#e8580a]/10 border border-[#e8580a]/20 flex items-center justify-center mt-0.5">
            <Mail size={22} className="text-[#e8580a]" />
          </div>
          <div className="min-w-0">
            <h2 className="text-[15px] font-bold text-white mb-1">Cách 2 — Gửi yêu cầu qua email</h2>
            <p className="text-[13px] text-[#8a7e72] mb-4">Dành cho trường hợp bạn đã gỡ ứng dụng hoặc không đăng nhập được.</p>
            <p className="text-[14px] text-[#c0b4a8] leading-relaxed mb-4">
              Gửi email từ <strong className="text-white">chính địa chỉ email đã đăng ký tài khoản</strong> tới{' '}
              <a href={`mailto:${CONTACT}?subject=Yeu cau xoa tai khoan MyTruyenAudio`} className="text-[#e8580a] hover:underline font-semibold">
                {CONTACT}
              </a>{' '}
              với tiêu đề <em className="text-[#d8ccc0]">&ldquo;Yêu cầu xoá tài khoản MyTruyenAudio&rdquo;</em> và nêu rõ email tài khoản cần xoá.
            </p>
            <p className="text-[14px] text-[#c0b4a8] leading-relaxed">
              Chúng tôi xác minh và xử lý trong vòng <strong className="text-white">7 ngày làm việc</strong>, sau đó gửi email xác nhận đã xoá.
            </p>
          </div>
        </section>

        {/* Dữ liệu bị xoá */}
        <section className="rounded-2xl bg-[#141210] border border-white/[0.06] p-6 flex gap-5">
          <div className="shrink-0 w-10 h-10 rounded-xl bg-[#e8580a]/10 border border-[#e8580a]/20 flex items-center justify-center mt-0.5">
            <ListChecks size={22} className="text-[#e8580a]" />
          </div>
          <div className="min-w-0">
            <h2 className="text-[15px] font-bold text-white mb-3">Dữ liệu sẽ bị xoá</h2>
            <ul className="flex flex-col gap-2.5 mb-5">
              {deleted.map((d, i) => (
                <li key={i} className="text-[14px] text-[#c0b4a8] leading-relaxed flex gap-2.5">
                  <span className="shrink-0 mt-[7px] w-1 h-1 rounded-full bg-[#e8580a]" />
                  <span>{d}</span>
                </li>
              ))}
            </ul>
            <h3 className="text-[14px] font-bold text-white mb-2">Dữ liệu được giữ lại</h3>
            <p className="text-[14px] text-[#c0b4a8] leading-relaxed">
              Bản sao lưu cơ sở dữ liệu định kỳ có thể còn chứa dữ liệu của bạn tối đa{' '}
              <strong className="text-white">30 ngày</strong> trước khi bị ghi đè. Nhật ký máy chủ ở dạng ẩn danh
              (không gắn với danh tính của bạn) được giữ tối đa 90 ngày cho mục đích bảo mật và vận hành.
            </p>
          </div>
        </section>

        {/* Cảnh báo */}
        <div className="rounded-2xl bg-[#3d1414] border border-[#ff5252]/25 p-6 flex gap-4">
          <AlertTriangle size={22} className="text-[#ff6b6b] shrink-0 mt-0.5" />
          <div>
            <h2 className="text-[15px] font-bold text-white mb-2">Không thể hoàn tác</h2>
            <p className="text-[14px] text-[#e0c4c4] leading-relaxed">
              Sau khi xoá, tài khoản và toàn bộ dữ liệu biến mất vĩnh viễn — chúng tôi không thể khôi phục,
              kể cả khi bạn đăng ký lại bằng đúng địa chỉ email cũ.
            </p>
          </div>
        </div>

        <p className="text-center text-[12px] text-[#8a7e72] pt-4 border-t border-white/[0.05]">
          Xem thêm{' '}
          <Link href="/chinh-sach" className="text-[#e8580a] hover:underline">Chính sách bảo mật</Link> ·{' '}
          <a href={`mailto:${CONTACT}`} className="text-[#e8580a] hover:underline">{CONTACT}</a>
        </p>
      </div>
    </main>
  );
}
