import { NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';
import db from '@/lib/db';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'webtruyen-secret-key-123456';
// Web Client ID from Google Cloud Console
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';

const client = new OAuth2Client(GOOGLE_CLIENT_ID);

export async function POST(req: Request) {
    try {
        const { idToken } = await req.json();

        if (!idToken) {
            return NextResponse.json({ error: 'Missing idToken' }, { status: 400 });
        }

        // Verify the Google ID token
        let payload;
        try {
            const ticket = await client.verifyIdToken({
                idToken,
                audience: GOOGLE_CLIENT_ID || undefined,
            });
            payload = ticket.getPayload();
        } catch (verifyError) {
            console.error('Google token verification failed:', verifyError);
            return NextResponse.json({ error: 'Invalid Google token' }, { status: 401 });
        }

        if (!payload || !payload.email) {
            return NextResponse.json({ error: 'Invalid Google token payload' }, { status: 401 });
        }

        const { sub: googleId, email, name, picture } = payload;

        // Upsert user: find by googleId first, then by email
        let user = await db.user.findFirst({
            where: {
                OR: [
                    { googleId },
                    { email },
                ],
            },
        });

        if (user) {
            // Update with Google info if not already set
            if (!user.googleId) {
                user = await db.user.update({
                    where: { id: user.id },
                    data: { googleId, image: picture ?? user.image },
                });
            }
        } else {
            // Create new user
            user = await db.user.create({
                data: {
                    email: email!,
                    name: name ?? email!.split('@')[0],
                    image: picture ?? null,
                    googleId,
                    // No password for Google users
                },
            });
        }

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
            },
        });
    } catch (error) {
        console.error('Google auth error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
