import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import Credentials from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import db from './lib/db';
import bcrypt from 'bcryptjs';

export const { auth, signIn, signOut, handlers } = NextAuth({
    ...authConfig,
    adapter: PrismaAdapter(db),
    session: { strategy: "jwt" },
    providers: [
        Credentials({
            async authorize(credentials) {
                const { email, password } = credentials as any;
                if (!email || !password) return null;

                const user = await db.user.findUnique({ where: { email } });
                if (!user || !user.password) return null;

                const passwordsMatch = await bcrypt.compare(password, user.password);
                if (passwordsMatch) return user;
                return null;
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.role = user.role || "USER";
                token.id = user.id || "";
                token.chaptersRead = (user as any).chaptersRead ?? 0;
                token.image = user.image || null;
            }
            // Luôn refresh từ DB để cập nhật realtime (chaptersRead + image)
            if (token.id) {
                const freshUser = await db.user.findUnique({
                    where: { id: token.id as string },
                    select: { chaptersRead: true, image: true, name: true },
                });
                if (freshUser) {
                    token.chaptersRead = freshUser.chaptersRead;
                    token.image = freshUser.image;
                    token.name = freshUser.name;
                }
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user && token) {
                session.user.role = token.role as string;
                session.user.id = token.id as string;
                session.user.chaptersRead = token.chaptersRead as number;
                session.user.image = token.image as string | null;
                session.user.name = token.name as string;
            }
            return session;
        }
    }
});
