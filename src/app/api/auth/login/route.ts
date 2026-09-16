import { NextResponse } from 'next/server';
import db from '@/lib/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {
    getClientIp,
    isRateLimited,
    recordFailure,
    resetRateLimit,
} from '@/lib/rateLimit';

const JWT_SECRET = process.env.JWT_SECRET as string;

// Chống dò mật khẩu. Hai lớp khoá vì mỗi lớp bịt một kiểu tấn công khác nhau:
//  - Theo EMAIL: chặn kẻ nhắm vào MỘT tài khoản cụ thể rồi thử hàng nghìn mật khẩu.
//  - Theo IP: chặn kẻ quét hàng loạt email khác nhau — kiểu tấn công mà khoá theo
//    email không thấy gì, vì mỗi email chỉ bị thử một vài lần.
// Ngưỡng IP nới rộng hơn nhiều vì nhiều người có thể dùng chung một IP (nhà mạng,
// wifi công cộng), khoá chặt sẽ vạ lây người vô tội.
const LOGIN_EMAIL_LIMIT = 5;
const LOGIN_IP_LIMIT = 20;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export async function POST(req: Request) {
    try {
        const { email, password } = await req.json();

        if (!email || !password) {
            return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });
        }

        // Normalize email về lowercase để tránh case-sensitive
        const normalizedEmail = email.trim().toLowerCase();

        const ipKey = `login:ip:${getClientIp(req)}`;
        const emailKey = `login:email:${normalizedEmail}`;

        // Kiểm tra TRƯỚC khi chạm vào DB và bcrypt: bcrypt.compare cố tình tốn CPU,
        // để kẻ tấn công ép server băm hàng nghìn lần cũng là một kiểu bào tài nguyên.
        for (const [key, limit] of [
            [ipKey, LOGIN_IP_LIMIT],
            [emailKey, LOGIN_EMAIL_LIMIT],
        ] as const) {
            const rl = isRateLimited(key, limit);
            if (!rl.ok) {
                return NextResponse.json(
                    { error: 'Bạn đã thử sai quá nhiều lần. Vui lòng thử lại sau ít phút.' },
                    { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
                );
            }
        }

        const user = await db.user.findUnique({ where: { email: normalizedEmail } });

        // Dùng CHUNG một thông báo cho "email không tồn tại" và "sai mật khẩu" —
        // tách ra là vô tình cho kẻ tấn công một công cụ dò xem email nào có đăng ký.
        if (!user || !user.password) {
            recordFailure(ipKey, LOGIN_WINDOW_MS);
            recordFailure(emailKey, LOGIN_WINDOW_MS);
            return NextResponse.json({ error: 'Email hoặc mật khẩu không chính xác' }, { status: 401 });
        }

        const passwordsMatch = await bcrypt.compare(password, user.password);

        if (!passwordsMatch) {
            recordFailure(ipKey, LOGIN_WINDOW_MS);
            recordFailure(emailKey, LOGIN_WINDOW_MS);
            return NextResponse.json({ error: 'Email hoặc mật khẩu không chính xác' }, { status: 401 });
        }

        // Đăng nhập đúng → xoá bộ đếm của email này, để người dùng thật lỡ gõ sai
        // vài lần rồi nhớ ra mật khẩu không bị treo tiếp.
        // CỐ Ý không xoá bộ đếm theo IP: kẻ tấn công sở hữu một tài khoản hợp lệ sẽ
        // lợi dụng việc đăng nhập đúng để reset quota rồi dò tiếp tài khoản khác.
        resetRateLimit(emailKey);

        // Generate JWT
        const token = jwt.sign(
            { id: user.id, email: user.email, name: user.name, role: user.role },
            JWT_SECRET,
            { expiresIn: '30d' }
        );

        return NextResponse.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                image: user.image,
                chaptersRead: user.chaptersRead,
                ageConfirmed: user.ageConfirmed,
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
