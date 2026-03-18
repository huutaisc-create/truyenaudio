import NextAuth from 'next-auth';
import { authConfig } from './auth.config';

export default NextAuth(authConfig).auth;

export const config = {
    matcher: [
        // ✅ Chỉ chạy auth middleware trên các route cần bảo vệ
        // Bỏ các trang public (trang chủ, chi tiết truyện, trang đọc, tìm kiếm, xếp hạng)
        // → Các trang này không cần auth check → không query DB → cache Edge hoạt động
        '/admin/:path*',
        '/tai-khoan/:path*',
        '/api/auth/:path*',
    ],
};
