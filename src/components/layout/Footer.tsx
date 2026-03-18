import React from 'react';
import Link from 'next/link';
import { BookOpen, Github, Facebook, Twitter } from 'lucide-react';

const Footer = () => {
    return (
        <footer className="border-t border-zinc-100 bg-[#f8f8f8] py-12 text-zinc-500">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-4">

                    {/* Brand */}
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-primary">
                                <BookOpen className="h-5 w-5 text-white" aria-hidden="true" />
                            </div>
                            <span className="text-lg font-bold text-zinc-800">MêTruyệnChữ</span>
                        </div>
                        <p className="text-sm leading-relaxed">
                            MêTruyệnChữ - Nền tảng đọc truyện chữ online miễn phí, không quảng cáo, cập nhật liên tục các tiểu thuyết hay nhất.
                        </p>
                        {/* FIX A11Y (ảnh 4): Thêm aria-label cho link mạng xã hội */}
                        <div className="flex gap-4">
                            <a href="#" aria-label="Trang Facebook của MêTruyệnChữ" className="hover:text-brand-primary transition-colors">
                                <Facebook className="h-5 w-5" aria-hidden="true" />
                            </a>
                            <a href="#" aria-label="Trang Twitter của MêTruyệnChữ" className="hover:text-brand-primary transition-colors">
                                <Twitter className="h-5 w-5" aria-hidden="true" />
                            </a>
                            <a href="#" aria-label="Trang Github của MêTruyệnChữ" className="hover:text-brand-primary transition-colors">
                                <Github className="h-5 w-5" aria-hidden="true" />
                            </a>
                        </div>
                    </div>

                    {/* Links 1 */}
                    <div>
                        <h3 className="mb-6 text-sm font-bold uppercase tracking-wider text-zinc-800">Khám phá</h3>
                        <ul className="space-y-3 text-sm">
                            <li><Link href="/xep-hang?tab=new" className="hover:text-brand-primary transition-colors">Truyện mới cập nhật</Link></li>
                            <li><Link href="/xep-hang?tab=hot" className="hover:text-brand-primary transition-colors">Truyện hot nhất</Link></li>
                            <li><Link href="/xep-hang?tab=completed" className="hover:text-brand-primary transition-colors">Truyện full</Link></li>
                            <li><Link href="/xep-hang" className="hover:text-brand-primary transition-colors">Bảng xếp hạng</Link></li>
                        </ul>
                    </div>

                    {/* Links 2 */}
                    <div>
                        <h3 className="mb-6 text-sm font-bold uppercase tracking-wider text-zinc-800">Hỗ trợ</h3>
                        <ul className="space-y-3 text-sm">
                            <li><Link href="/dieu-khoan" className="hover:text-brand-primary transition-colors">Điều khoản dịch vụ</Link></li>
                            <li><Link href="/chinh-sach" className="hover:text-brand-primary transition-colors">Chính sách bảo mật</Link></li>
                            <li><Link href="/ban-quyen" className="hover:text-brand-primary transition-colors">Liên hệ bản quyền</Link></li>
                        </ul>
                    </div>

                    {/* Về chúng tôi */}
                    <div>
                        <h3 className="mb-6 text-sm font-bold uppercase tracking-wider text-zinc-800">Về chúng tôi</h3>
                        <p className="text-xs leading-relaxed italic text-zinc-400">
                            MeTruyenChu là website đọc truyện online miễn phí với giao diện thân thiện, dễ sử dụng. Chúng tôi cam kết mang lại trải nghiệm tốt nhất cho độc giả.
                        </p>
                    </div>
                </div>

                <div className="mt-12 border-t border-zinc-200 pt-8 text-center text-xs">
                    <p>© 2026 MêTruyệnChữ Team. All rights reserved.</p>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
