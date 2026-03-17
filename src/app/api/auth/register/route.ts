import { NextResponse } from 'next/server';
import db from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function POST(req: Request) {
    try {
        const { name, email, password } = await req.json();

        if (!name || !email || !password) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Normalize email về lowercase để tránh case-sensitive
        const normalizedEmail = email.trim().toLowerCase();

        const existingUser = await db.user.findUnique({ where: { email: normalizedEmail } });

        if (existingUser) {
            return NextResponse.json({ error: 'Email đã được sử dụng' }, { status: 409 });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await db.user.create({
            data: {
                name: name.trim(),
                email: normalizedEmail,
                password: hashedPassword,
            },
        });

        return NextResponse.json({
            message: 'Đăng ký thành công',
            user: { id: user.id, email: user.email, name: user.name }
        }, { status: 201 });
    } catch (error) {
        console.error('Register error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
