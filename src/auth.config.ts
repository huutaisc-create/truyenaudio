import type { NextAuthConfig } from "next-auth"
import Google from "next-auth/providers/google"

export const authConfig = {
    pages: {
        signIn: '/login',
    },
    callbacks: {
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user
            const isOnDashboard = nextUrl.pathname.startsWith('/admin')
            if (isOnDashboard) {
                if (isLoggedIn) return true
                return false
            }
            return true
        },
    },
    providers: [Google],
} satisfies NextAuthConfig
