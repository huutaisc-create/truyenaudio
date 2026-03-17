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
                console.log("Authorize called with:", credentials);
                const { email, password } = credentials as any;

                if (!email || !password) {
                    console.log("Missing credentials");
                    return null;
                }

                const user = await db.user.findUnique({ where: { email } });
                console.log("User found:", user ? user.email : "Not found");

                if (!user || !user.password) return null;

                const passwordsMatch = await bcrypt.compare(password, user.password);
                console.log("Password match:", passwordsMatch);

                if (passwordsMatch) return user;

                console.log("Invalid password");
                return null;
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.role = (user.role || "USER");
                token.id = (user.id || "");
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user && token) {
                session.user.role = token.role as string;
                session.user.id = token.id as string;
            }
            return session;
        }
    }
});
