'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import Link from 'next/link'
import { BookOpen, Settings2 } from 'lucide-react'
import GenrePickerModal from './GenrePickerModal'

interface Story {
    id: string
    title: string
    slug: string
    coverImage: string | null
    status: string
}

interface Props {
    stories: Story[]        // server-side initial data
    genrePrefs: string[]    // server-side initial prefs
    showPicker: boolean     // true = chưa chọn genre lần nào
}

export default function ForYouSection({ stories: initStories, genrePrefs: initPrefs, showPicker }: Props) {
    const [modalOpen, setModalOpen] = useState(false)
    const [genrePrefs, setGenrePrefs] = useState<string[]>(initPrefs)
    const [stories, setStories] = useState<Story[]>(initStories)
    const [loading, setLoading] = useState(false)

    // Auto-open modal lần đầu vào trang
    useEffect(() => {
        if (showPicker) {
            const t = setTimeout(() => setModalOpen(true), 800)
            return () => clearTimeout(t)
        }
    }, [showPicker])

    // Khi user lưu genre mới → fetch stories ngay, không cần reload
    async function handleSave(genres: string[]) {
        setGenrePrefs(genres)
        setLoading(true)
        try {
            const res = await fetch(`/api/for-you?genres=${encodeURIComponent(genres.join(','))}`)
            const data = await res.json()
            setStories(data.stories ?? [])
        } catch {
            // fallback: giữ nguyên stories cũ
        } finally {
            setLoading(false)
        }
    }

    const hasPrefs = genrePrefs.length > 0

    return (
        <>
            <GenrePickerModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                onSave={handleSave}
                initialSelected={genrePrefs}
            />

            <section id="section-foryou" className="scroll-mt-20" aria-label="Dành cho bạn">
                {/* Header */}
                <div className="py-5 flex items-center justify-between">
                    {/* Pill + nút đổi sở thích sát nhau */}
                    <div className="flex items-center gap-2">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full"
                            style={{
                                background: 'var(--pill2-bg)',
                                border: '1px solid var(--pill2-border)',
                                color: 'var(--pill2-color)',
                            }}>
                            <span className="text-sm leading-none" aria-hidden="true">⭐</span>
                            <span className="text-sm font-black uppercase tracking-[.08em]">Dành Cho Bạn</span>
                        </div>

                        {hasPrefs && (
                            <button
                                onClick={() => setModalOpen(true)}
                                className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-full transition-all hover:opacity-80"
                                style={{
                                    color: 'var(--text-muted)',
                                    background: 'var(--card)',
                                    border: '1px solid var(--border)',
                                }}
                            >
                                <Settings2 className="h-3 w-3" />
                                Đổi sở thích
                            </button>
                        )}
                    </div>

                    {/* Link Tất cả → tim-kiem với genres map sẵn */}
                    {hasPrefs && (
                        <Link
                            href={`/tim-kiem?the-loai=${encodeURIComponent(genrePrefs.join(','))}`}
                            className="inline-flex items-center gap-1 px-4 py-2 rounded-full text-sm font-bold border-[1.5px] transition-all"
                            style={{
                                borderColor: 'var(--accent)',
                                color: 'var(--accent)',
                                background: 'transparent',
                            }}
                        >
                            Tất cả →
                        </Link>
                    )}
                </div>

                {/* Placeholder — chưa chọn genre */}
                {!hasPrefs && (
                    <div
                        className="rounded-xl flex flex-col items-center justify-center py-12 text-center border-2 border-dashed cursor-pointer hover:opacity-80 transition-opacity"
                        style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
                        onClick={() => setModalOpen(true)}
                    >
                        <div className="text-4xl mb-3">✨</div>
                        <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text)' }}>
                            Chọn thể loại yêu thích
                        </p>
                        <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
                            Để chúng tôi gợi ý truyện phù hợp với bạn
                        </p>
                        <span
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold text-white"
                            style={{ background: 'var(--accent)' }}
                        >
                            Chọn ngay →
                        </span>
                    </div>
                )}

                {/* Đã chọn genre */}
                {hasPrefs && (
                    <>
                        {/* Genre tags */}
                        <div className="flex flex-wrap gap-1.5 mb-4">
                            {genrePrefs.map(g => (
                                <span key={g}
                                    className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium"
                                    style={{
                                        background: 'var(--card)',
                                        border: '1px solid var(--border)',
                                        color: 'var(--text-muted)',
                                    }}>
                                    {g}
                                </span>
                            ))}
                        </div>

                        {/* Loading skeleton */}
                        {loading && (
                            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                                {Array.from({ length: 8 }).map((_, i) => (
                                    <div key={i} className="aspect-[3/4] rounded-lg animate-pulse"
                                        style={{ background: 'var(--card2)' }} />
                                ))}
                            </div>
                        )}

                        {/* Stories grid */}
                        {!loading && stories.length === 0 && (
                            <div className="rounded-xl p-8 text-center" style={{ background: 'var(--card)' }}>
                                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                                    Chưa có truyện nào cho thể loại bạn chọn.{' '}
                                    <button
                                        onClick={() => setModalOpen(true)}
                                        className="underline"
                                        style={{ color: 'var(--accent)' }}
                                    >
                                        Đổi sở thích?
                                    </button>
                                </p>
                            </div>
                        )}

                        {!loading && stories.length > 0 && (
                            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                                {stories.map((story, i) => (
                                    <ForYouCard key={story.id} story={story} priority={i < 4} />
                                ))}
                            </div>
                        )}
                    </>
                )}
            </section>
        </>
    )
}

function ForYouCard({ story, priority }: { story: Story; priority?: boolean }) {
    return (
        <div className="group cursor-pointer relative">
            <div
                className="relative aspect-[3/4] overflow-hidden rounded-lg shadow-sm transition-all group-hover:shadow-lg group-hover:-translate-y-0.5"
                style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
            >
                <Link href={`/truyen/${story.slug}`} className="block absolute inset-0 z-0" aria-label={`Xem truyện ${story.title}`}>
                    {story.coverImage ? (
                        <Image
                            src={story.coverImage}
                            alt={story.title}
                            fill
                            sizes="(max-width: 640px) 45vw, (max-width: 768px) 30vw, 18vw"
                            className="object-cover transition-transform duration-300 group-hover:scale-105"
                            priority={priority}
                        />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center" style={{ background: 'var(--card2)' }}>
                            <BookOpen className="h-10 w-10 opacity-20" style={{ color: 'var(--text-muted)' }} />
                        </div>
                    )}
                    <div
                        className="absolute inset-x-0 bottom-0 p-2 pt-10 flex flex-col justify-end"
                        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.4) 55%, transparent 100%)' }}
                    >
                        <h3 className="line-clamp-2 text-sm font-bold text-white leading-tight group-hover:text-orange-300 transition-colors">
                            {story.title}
                        </h3>
                    </div>
                </Link>
                {story.status === 'COMPLETED' && (
                    <span className="absolute top-0 left-0 bg-red-600 text-white text-[9px] font-bold px-2 py-0.5 z-10 uppercase tracking-wider rounded-br-md">
                        Full
                    </span>
                )}
            </div>
        </div>
    )
}
