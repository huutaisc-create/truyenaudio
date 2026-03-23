import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { PrismaAdapter } from '@auth/prisma-adapter';
import db from './lib/db';
import bcrypt from 'bcryptjs';

export const { auth, signIn, signOut, handlers } = NextAuth({
    ...authConfig,
    adapter: PrismaAdapter(db),
    session: { strategy: "jwt" },
    providers: [
        Google({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            allowDangerousEmailAccountLinking: true,
        }),
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
        async signIn({ user, account }) {
            // Google login: upsert user vào DB
            if (account?.provider === 'google' && user.email) {
                const existing = await db.user.findUnique({
                    where: { email: user.email },
                });
                if (!existing) {
                    await db.user.create({
                        data: {
                            email: user.email,
                            name: user.name ?? '',
                            image: user.image ?? null,
                            googleId: account.providerAccountId,
                        },
                    });
                } else if (!existing.googleId) {
                    // Link Google vào account đã có
                    await db.user.update({
                        where: { email: user.email },
                        data: {
                            googleId: account.providerAccountId,
                            image: existing.image ?? user.image ?? null,
                        },
                    });
                }
            }
            return true;
        },
        async jwt({ token, user, trigger, session }) {
            if (user) {
                // Lấy thêm role từ DB (Google login không có role trong user object)
                const dbUser = await db.user.findUnique({
                    where: { email: user.email! },
                    select: { id: true, role: true, chaptersRead: true, image: true },
                });
                token.role = dbUser?.role ?? "USER";
                token.id = dbUser?.id ?? user.id ?? "";
                token.chaptersRead = dbUser?.chaptersRead ?? 0;
                token.image = dbUser?.image ?? user.image ?? null;
            }

            if (trigger === 'update' && token.id) {
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
