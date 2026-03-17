import NextAuth, { DefaultSession } from "next-auth"
import { JWT } from "next-auth/jwt"

declare module "next-auth" {
    interface Session {
        user: {
            role: string
            id: string
            chaptersRead: number
        } & DefaultSession["user"]
    }

    interface User {
        role?: string
        chaptersRead?: number
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        role: string
        id: string
        chaptersRead: number
    }
}
