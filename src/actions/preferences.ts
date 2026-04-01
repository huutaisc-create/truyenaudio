'use server'

import { cookies } from 'next/headers'
import { auth } from '@/auth'
import db from '@/lib/db'

const COOKIE_NAME = 'genre_prefs'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 năm

export async function saveGenrePrefs(genres: string[]) {
    const cookieStore = await cookies()
    cookieStore.set(COOKIE_NAME, JSON.stringify(genres), {
        maxAge: COOKIE_MAX_AGE,
        path: '/',
        sameSite: 'lax',
    })

    // Nếu đã đăng nhập → lưu DB luôn
    const session = await auth()
    if (session?.user?.id) {
        await db.user.update({
            where: { id: session.user.id },
            data: { favoriteGenres: genres },
        }).catch(() => {})
    }
}

export async function getGenrePrefs(): Promise<string[]> {
    const cookieStore = await cookies()
    const cookie = cookieStore.get(COOKIE_NAME)
    if (!cookie?.value) return []
    try {
        const parsed = JSON.parse(cookie.value)
        return Array.isArray(parsed) ? parsed : []
    } catch {
        return []
    }
}

/** Sync DB → cookie cho user đã login nhưng chưa có cookie */
export async function syncGenrePrefsFromDb(): Promise<string[]> {
    const session = await auth()
    if (!session?.user?.id) return []

    const user = await db.user.findUnique({
        where: { id: session.user.id },
        select: { favoriteGenres: true },
    })
    const genres = user?.favoriteGenres ?? []
    if (genres.length > 0) {
        const cookieStore = await cookies()
        cookieStore.set(COOKIE_NAME, JSON.stringify(genres), {
            maxAge: COOKIE_MAX_AGE,
            path: '/',
            sameSite: 'lax',
        })
    }
    return genres
}
