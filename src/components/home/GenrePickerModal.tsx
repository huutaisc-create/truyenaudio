'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveGenrePrefs } from '@/actions/preferences'
import { GENRES } from '@/lib/constants'
import { Sparkles, Check } from 'lucide-react'

interface Props {
    open: boolean
    onClose: () => void
    initialSelected?: string[]
}

export default function GenrePickerModal({ open, onClose, initialSelected = [] }: Props) {
    const router = useRouter()
    const [selected, setSelected] = useState<string[]>(initialSelected)
    const [saving, setSaving] = useState(false)

    if (!open) return null

    function toggle(genre: string) {
        setSelected(prev =>
            prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre]
        )
    }

    async function handleConfirm() {
        if (selected.length === 0) return
        setSaving(true)
        await saveGenrePrefs(selected)
        setSaving(false)
        onClose()
        router.refresh()
    }

    // Lọc ra những genre thực sự là GENRE (không phải BOI_CANH, TINH_CACH…)
    const displayGenres = GENRES.filter((v, i, a) => a.indexOf(v) === i) // dedup

    return (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
            {/* Overlay */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

            {/* Modal */}
            <div className="relative w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90vh] sm:max-h-[85vh]">
                {/* Header */}
                <div className="px-6 pt-6 pb-4 shrink-0">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center text-xl">
                            ✨
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">Thể loại yêu thích</h2>
                            <p className="text-sm text-gray-500">Chọn để nhận gợi ý phù hợp với bạn</p>
                        </div>
                    </div>

                    {/* Progress */}
                    <div className="flex items-center gap-2 mt-3">
                        <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                            <div
                                className="h-full bg-orange-500 rounded-full transition-all duration-300"
                                style={{ width: selected.length > 0 ? '100%' : '0%' }}
                            />
                        </div>
                        <span className={`text-xs font-semibold shrink-0 ${selected.length > 0 ? 'text-orange-500' : 'text-gray-400'}`}>
                            {selected.length > 0 ? `${selected.length} đã chọn` : 'Chọn ít nhất 1'}
                        </span>
                    </div>
                </div>

                {/* Genre grid */}
                <div className="flex-1 overflow-y-auto px-6 pb-2">
                    <div className="flex flex-wrap gap-2 py-2">
                        {displayGenres.map(genre => {
                            const isSelected = selected.includes(genre)
                            return (
                                <button
                                    key={genre}
                                    onClick={() => toggle(genre)}
                                    className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition-all duration-150 ${
                                        isSelected
                                            ? 'bg-orange-500 text-white shadow-sm shadow-orange-200'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                >
                                    {isSelected && <Check className="h-3.5 w-3.5 shrink-0" />}
                                    {genre}
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 shrink-0">
                    <button
                        onClick={handleConfirm}
                        disabled={selected.length === 0 || saving}
                        className={`w-full py-3 rounded-xl text-sm font-bold transition-all ${
                            selected.length > 0
                                ? 'bg-orange-500 text-white hover:bg-orange-600 shadow-lg shadow-orange-200'
                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }`}
                    >
                        {saving ? 'Đang lưu...' : `Xác nhận${selected.length > 0 ? ` (${selected.length})` : ''}`}
                    </button>
                </div>
            </div>
        </div>
    )
}
