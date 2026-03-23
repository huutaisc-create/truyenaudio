'use client'

import { useActionState, useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { authenticate } from '../actions'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Loader2, Mail, Lock, BookOpen } from 'lucide-react'

export default function LoginPage() {
    const searchParams = useSearchParams()
    const callbackUrl = searchParams.get('callbackUrl') || '/'

    const [errorMessage, formAction, isPending] = useActionState(
        authenticate,
        undefined,
    )

    const handleGoogleLogin = () => {
        signIn('google', { callbackUrl })
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-warm-bg px-4 py-12">
            <div className="w-full max-w-md space-y-6">

                {/* Header */}
                <div className="text-center">
                    <div className="flex justify-center mb-4">
                        <div className="w-16 h-16 rounded-2xl bg-warm-primary flex items-center justify-center shadow-lg">
                            <BookOpen className="h-8 w-8 text-white" />
                        </div>
                    </div>
                    <h1 className="text-2xl font-bold text-warm-ink">Chào mừng trở lại!</h1>
                    <p className="text-sm text-warm-ink-soft mt-1">Đăng nhập để tiếp tục đọc truyện</p>
                </div>

                {/* Card */}
                <div className="bg-warm-card rounded-2xl border border-warm-border-soft shadow-sm p-6 space-y-5">

                    {/* Google button */}
                    <button
                        onClick={handleGoogleLogin}
                        type="button"
                        className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-warm-border bg-warm-bg hover:bg-warm-border-soft transition-all font-semibold text-warm-ink text-sm active:scale-95"
                    >
                        <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        Đăng nhập với Google
                    </button>

                    {/* Divider */}
                    <div className="flex items-center gap-3">
                        <div className="flex-1 h-px bg-warm-border" />
                        <span className="text-xs text-warm-ink-soft font-medium">hoặc</span>
                        <div className="flex-1 h-px bg-warm-border" />
                    </div>

                    {/* Email/password form */}
                    <form action={formAction} className="space-y-4">
                        {/* hidden callbackUrl */}
                        <input type="hidden" name="callbackUrl" value={callbackUrl} />

                        {/* Email */}
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-warm-ink-soft" />
                            <input
                                id="email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                placeholder="Email"
                                className="w-full pl-10 pr-4 py-3 rounded-xl bg-warm-bg border border-warm-border text-warm-ink placeholder:text-warm-ink-soft text-sm outline-none focus:border-warm-primary transition-colors"
                            />
                        </div>

                        {/* Password */}
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-warm-ink-soft" />
                            <input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete="current-password"
                                required
                                placeholder="Mật khẩu"
                                className="w-full pl-10 pr-4 py-3 rounded-xl bg-warm-bg border border-warm-border text-warm-ink placeholder:text-warm-ink-soft text-sm outline-none focus:border-warm-primary transition-colors"
                            />
                        </div>

                        {/* Error */}
                        {errorMessage && (
                            <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">
                                {errorMessage}
                            </p>
                        )}

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={isPending}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-warm-primary hover:bg-warm-primary-soft text-white font-bold text-sm transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {isPending
                                ? <><Loader2 className="h-4 w-4 animate-spin" /> Đang đăng nhập...</>
                                : 'Đăng nhập'
                            }
                        </button>
                    </form>
                </div>

                {/* Register link */}
                <p className="text-center text-sm text-warm-ink-soft">
                    Chưa có tài khoản?{' '}
                    <Link
                        href={`/register?callbackUrl=${encodeURIComponent(callbackUrl)}`}
                        className="font-bold text-warm-primary hover:underline"
                    >
                        Đăng ký ngay
                    </Link>
                </p>
            </div>
        </div>
    )
}
