import { NextResponse } from 'next/server';
import db from '@/lib/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getClientIp, rateLimit } from '@/lib/rateLimit';

const JWT_SECRET = process.env.JWT_SECRET as string;

// MỌI ràng buộc dưới đây PHẢI có ở backend, không được chỉ dựa vào form trong app:
// script gọi thẳng API không đi qua giao diện nào cả.
const NAME_MIN = 2;
const NAME_MAX = 50;
const PASSWORD_MIN = 6;
const PASSWORD_MAX = 72; // bcrypt cắt cụt sau 72 BYTE — dài hơn là phần thừa bị bỏ lặng lẽ
const EMAIL_MAX = 254;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

// Chặn tạo tài khoản hàng loạt. Quan trọng vì hệ credit (điểm danh, bình luận)
// khiến việc mở tài khoản hàng loạt trở thành bước đầu của chuỗi farm credit.
const REGISTER_LIMIT = 5;
const REGISTER_WINDOW_MS = 60 * 60 * 1000; // 5 tài khoản / IP / giờ

/** Prisma ném lỗi mã P2002 khi vi phạm ràng buộc unique. */
function isUniqueViolation(e: unknown): boolean {
    return (
        typeof e === 'object' &&
        e !== null &&
        (e as { code?: unknown }).code === 'P2002'
    );
}

export async function POST(req: Request) {
    try {
        const ip = getClientIp(req);
        const rl = rateLimit(`register:${ip}`, REGISTER_LIMIT, REGISTER_WINDOW_MS);
        if (!rl.ok) {
            return NextResponse.json(
                { error: 'Bạn đã tạo quá nhiều tài khoản từ thiết bị này. Thử lại sau nhé.' },
                { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
            );
        }

        const body = await req.json().catch(() => ({}));
        const name = typeof body?.name === 'string' ? body.name.trim() : '';
        const rawEmail = typeof body?.email === 'string' ? body.email : '';
        const password = typeof body?.password === 'string' ? body.password : '';

        if (!name || !rawEmail || !password) {
            return NextResponse.json(
                { error: 'Vui lòng nhập đủ tên, email và mật khẩu' },
                { status: 400 }
            );
        }
        if (name.length < NAME_MIN || name.length > NAME_MAX) {
            return NextResponse.json(
                { error: `Tên phải từ ${NAME_MIN} đến ${NAME_MAX} ký tự` },
                { status: 400 }
            );
        }

        const email = rawEmail.trim().toLowerCase();
        if (email.length > EMAIL_MAX || !EMAIL_RE.test(email)) {
            return NextResponse.json({ error: 'Email không hợp lệ' }, { status: 400 });
        }

        if (password.length < PASSWORD_MIN) {
            return NextResponse.json(
                { error: `Mật khẩu phải có ít nhất ${PASSWORD_MIN} ký tự` },
                { status: 400 }
            );
        }
        if (Buffer.byteLength(password, 'utf8') > PASSWORD_MAX) {
            return NextResponse.json(
                { error: `Mật khẩu quá dài (tối đa ${PASSWORD_MAX} ký tự)` },
                { status: 400 }
            );
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Tạo THẲNG rồi bắt lỗi trùng, KHÔNG findUnique-rồi-create nữa: hai request
        // cùng email gửi đồng thời đều vượt qua bước kiểm tra, rồi một cái chết ở
        // ràng buộc unique và trả về 500 thay vì báo đúng "Email đã được sử dụng".
        let user;
        try {
            user = await db.user.create({
                data: { name, email, password: hashedPassword },
            });
        } catch (e) {
            if (isUniqueViolation(e)) {
                return NextResponse.json({ error: 'Email đã được sử dụng' }, { status: 409 });
            }
            throw e;
        }

        // Trả token luôn (giống /auth/login) để app đăng nhập thẳng sau khi đăng ký,
        // khỏi bắt người dùng gõ lại email + mật khẩu vừa nhập xong.
        const token = jwt.sign(
            { id: user.id, email: user.email, name: user.name, role: user.role },
            JWT_SECRET,
            { expiresIn: '30d' }
        );

        return NextResponse.json(
            {
                message: 'Đăng ký thành công',
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                    image: user.image,
                    chaptersRead: user.chaptersRead,
                },
            },
            { status: 201 }
        );
    } catch (error) {
        console.error('Register error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
