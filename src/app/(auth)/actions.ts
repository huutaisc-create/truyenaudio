'use server'

import { signIn } from '@/auth'
import db from '@/lib/db'
import bcrypt from 'bcryptjs'
import { AuthError } from 'next-auth'

export async function authenticate(
    prevState: string | undefined,
    formData: FormData,
) {
    try {
        await signIn('credentials', {
            ...Object.fromEntries(formData),
            redirectTo: (formData.get('callbackUrl') as string) || '/',
        })
    } catch (error) {
        if (error instanceof AuthError) {
            switch (error.type) {
                case 'CredentialsSignin':
                    return 'Email hoặc mật khẩu không đúng.'
                default:
                    return 'Đã có lỗi xảy ra, thử lại sau.'
            }
        }
        throw error
    }
}

export async function register(
    prevState: string | undefined,
    formData: FormData,
) {
    const name = formData.get('name') as string
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    if (!name || !email || !password) {
        return 'Vui lòng điền đầy đủ thông tin.'
    }

    try {
        const existingUser = await db.user.findUnique({ where: { email } });
        if (existingUser) {
            return 'Email này đã được đăng ký.'
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await db.user.create({
            data: { name, email, password: hashedPassword },
        });

        return 'success'
    } catch (error) {
        return 'Tạo tài khoản thất bại, thử lại sau.'
    }
}
