import Link from 'next/link';

export const metadata = {
  title: 'Tải App Truyện Audio Của Tôi',
  description: 'Trải nghiệm nghe truyện tốt nhất trên ứng dụng di động của chúng tôi.',
};

export default function TaiAppPage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 py-12"
      style={{ background: 'var(--bg)' }}
    >
      {/* Glow background */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background: 'radial-gradient(ellipse 60% 50% at 50% 30%, var(--accent)18 0%, transparent 70%)',
        }}
        aria-hidden="true"
      />

      <div className="relative z-10 flex flex-col items-center text-center max-w-sm w-full">

        {/* Icon */}
        <div
          className="w-24 h-24 rounded-3xl flex items-center justify-center mb-6 shadow-2xl"
          style={{
            background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
            boxShadow: '0 0 60px var(--accent)44',
          }}
        >
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
            <path d="M24 6C14.059 6 6 14.059 6 24s8.059 18 18 18 18-8.059 18-18S33.941 6 24 6z" fill="white" fillOpacity="0.15"/>
            <path d="M20 16l12 8-12 8V16z" fill="white"/>
          </svg>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-black mb-2" style={{ color: 'var(--text)' }}>
          Truyện Audio Của Tôi
        </h1>
        <p className="text-sm mb-1 font-semibold" style={{ color: 'var(--accent)' }}>
          Nghe mọi lúc mọi nơi
        </p>
        <p className="text-sm mb-8" style={{ color: 'var(--text-muted)' }}>
          Tải app để trải nghiệm nghe truyện mượt mà hơn — không giới hạn, không quảng cáo, offline được.
        </p>

        {/* Download buttons */}
        <div className="flex flex-col gap-3 w-full mb-8">
          {/* App Store */}
          <a
            href="#"
            className="flex items-center gap-4 px-5 py-4 rounded-2xl transition-all active:scale-95"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
            }}
            aria-label="Tải về trên App Store"
          >
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <rect width="32" height="32" rx="8" fill="#000"/>
              <path d="M20.5 7.5c.3 1.6-.5 3.1-1.7 4.1-1.2 1-2.7 1.5-4 1.2-.3-1.5.5-3 1.7-4 1.2-1 2.8-1.5 4-1.3zM23 24.5c-.9 1.3-1.8 2.5-3.2 2.5-1.4 0-1.9-.8-3.5-.8-1.7 0-2.2.8-3.5.8-1.4 0-2.4-1.3-3.3-2.6-2.2-3.2-2.5-7-.9-9.4.9-1.5 2.3-2.4 3.8-2.4 1.5 0 2.4.8 3.6.8 1.2 0 1.9-.8 3.6-.8 1.3 0 2.6.7 3.5 2-3.1 1.7-2.6 6.1.6 7.4-.1.2-.2.3-.3.5z" fill="white"/>
            </svg>
            <div className="text-left">
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Tải về trên</p>
              <p className="text-base font-black" style={{ color: 'var(--text)' }}>App Store</p>
            </div>
            <svg className="ml-auto" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M6 4l4 4-4 4" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>

          {/* Google Play */}
          <a
            href="#"
            className="flex items-center gap-4 px-5 py-4 rounded-2xl transition-all active:scale-95"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
            }}
            aria-label="Tải về trên Google Play"
          >
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <rect width="32" height="32" rx="8" fill="#fff" fillOpacity="0.08"/>
              <path d="M8 7.2L18.8 16 8 24.8V7.2z" fill="#32BBFF"/>
              <path d="M22.4 13.6l-3.6-2.08L8 7.2l8.4 8.8 6-2.4z" fill="#32BBFF"/>
              <path d="M8 24.8l10.8-4.4 3.6-2.08-6-2.32L8 24.8z" fill="#32BBFF"/>
              <path d="M22.4 13.6L26 16l-3.6 2.32-6-2.32 6-2.4z" fill="#00AAFF"/>
            </svg>
            <div className="text-left">
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Tải về trên</p>
              <p className="text-base font-black" style={{ color: 'var(--text)' }}>Google Play</p>
            </div>
            <svg className="ml-auto" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M6 4l4 4-4 4" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>
        </div>

        {/* Features */}
        <div
          className="w-full rounded-2xl p-4 mb-8"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          {[
            { icon: '🎧', text: 'Nghe offline — không cần mạng' },
            { icon: '⚡', text: 'Tốc độ phát tùy chỉnh 0.7× – 2×' },
            { icon: '📚', text: 'Hàng nghìn truyện cập nhật mỗi ngày' },
            { icon: '🔔', text: 'Thông báo chương mới tức thì' },
          ].map(({ icon, text }) => (
            <div key={text} className="flex items-center gap-3 py-2">
              <span className="text-xl shrink-0">{icon}</span>
              <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{text}</span>
            </div>
          ))}
        </div>

        {/* Back link */}
        <Link
          href="/"
          className="text-sm font-semibold underline underline-offset-4 transition-opacity hover:opacity-70"
          style={{ color: 'var(--text-muted)' }}
        >
          Quay về trang chủ
        </Link>
      </div>
    </div>
  );
}
