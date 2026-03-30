import React from 'react';
import Link from 'next/link';
import { BookOpen, Github, Facebook, Twitter } from 'lucide-react';

const Footer = () => {
    return (
        <footer
            style={{
                background: 'var(--footer-bg)',
                borderTop: '1px solid var(--footer-border)',
            }}
            className="py-10"
        >
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">

                    {/* Brand */}
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-2">
                            <div
                                className="flex h-8 w-8 items-center justify-center rounded-lg"
                                style={{ background: 'var(--accent)' }}
                            >
                                <BookOpen className="h-5 w-5 text-white" aria-hidden="true" />
                            </div>
                            <span
                                className="text-lg font-bold"
                                style={{ fontFamily: 'Georgia, serif', color: 'var(--text)' }}
                            >
                                Mê<em className="not-italic" style={{ color: 'var(--accent)' }}>Truyện</em>Chữ
                            </span>
                        </div>
                        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                            MêTruyệnChữ - Nền tảng đọc truyện chữ online miễn phí, không quảng cáo, cập nhật liên tục các tiểu thuyết hay nhất.
                        </p>
                        <div className="flex gap-3">
                            {[
                                { href: '#', icon: <Facebook className="h-4 w-4" />, label: 'Facebook' },
                                { href: '#', icon: <Twitter className="h-4 w-4" />, label: 'Twitter' },
                                { href: '#', icon: <Github className="h-4 w-4" />, label: 'Github' },
                            ].map(({ href, icon, label }) => (
                                <a
                                    key={label}
                                    href={href}
                                    aria-label={`Trang ${label} của MêTruyệnChữ`}
                                    className="flex h-8 w-8 items-center justify-center rounded-lg transition-all"
                                    style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.borderColor = 'var(--accent)';
                                        e.currentTarget.style.color = 'var(--accent)';
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.borderColor = 'var(--border)';
                                        e.currentTarget.style.color = 'var(--text-muted)';
                                    }}
                                >
                                    {icon}
                                </a>
                            ))}
                        </div>
                    </div>

                    {/* Links 1 */}
                    <div>
                        <h3
                            className="mb-5 text-xs font-bold uppercase tracking-widest"
                            style={{ color: 'var(--text)' }}
                        >
                            Khám phá
                        </h3>
                        <ul className="space-y-3 text-sm">
                            {[
                                { href: '/xep-hang?tab=new', label: 'Truyện mới cập nhật' },
                                { href: '/xep-hang?tab=hot', label: 'Truyện hot nhất' },
                                { href: '/xep-hang?tab=completed', label: 'Truyện full' },
                                { href: '/xep-hang', label: 'Bảng xếp hạng' },
                            ].map(({ href, label }) => (
                                <li key={href}>
                                    <Link
                                        href={href}
                                        className="transition-colors"
                                        style={{ color: 'var(--footer-link)' }}
                                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
                                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--footer-link)')}
                                    >
                                        {label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Links 2 */}
                    <div>
                        <h3
                            className="mb-5 text-xs font-bold uppercase tracking-widest"
                            style={{ color: 'var(--text)' }}
                        >
                            Hỗ trợ
                        </h3>
                        <ul className="space-y-3 text-sm">
                            {[
                                { href: '/dieu-khoan', label: 'Điều khoản dịch vụ' },
                                { href: '/chinh-sach', label: 'Chính sách bảo mật' },
                                { href: '/ban-quyen', label: 'Liên hệ bản quyền' },
                            ].map(({ href, label }) => (
                                <li key={href}>
                                    <Link
                                        href={href}
                                        className="transition-colors"
                                        style={{ color: 'var(--footer-link)' }}
                                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
                                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--footer-link)')}
                                    >
                                        {label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Về chúng tôi */}
                    <div>
                        <h3
                            className="mb-5 text-xs font-bold uppercase tracking-widest"
                            style={{ color: 'var(--text)' }}
                        >
                            Về chúng tôi
                        </h3>
                        <p className="text-xs leading-relaxed italic" style={{ color: 'var(--text-soft)' }}>
                            MeTruyenChu là website đọc truyện online miễn phí với giao diện thân thiện, dễ sử dụng. Chúng tôi cam kết mang lại trải nghiệm tốt nhất cho độc giả.
                        </p>
                    </div>
                </div>

                <div
                    className="mt-10 pt-6 text-center text-xs"
                    style={{ borderTop: '1px solid var(--footer-border)', color: 'var(--text-soft)' }}
                >
                    <p>© 2026 MêTruyệnChữ Team. All rights reserved.</p>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
