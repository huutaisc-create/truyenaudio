'use client'

import { Eye, EyeOff } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toggleStoryHidden } from '@/actions/admin'

export default function ToggleHiddenButton({ storyId, isHidden }: { storyId: string; isHidden: boolean }) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [hidden, setHidden] = useState(isHidden)

    async function handleClick() {
        setLoading(true)
        setHidden(h => !h)
        await toggleStoryHidden(storyId, !hidden)
        setLoading(false)
        router.refresh()
    }

    return (
        <button
            onClick={handleClick}
            disabled={loading}
            title={hidden ? 'Đang ẩn — click để hiện' : 'Đang hiện — click để ẩn'}
            className={`transition-colors disabled:opacity-40 ${
                hidden
                    ? 'text-red-500 hover:text-red-700'
                    : 'text-gray-400 hover:text-gray-600'
            }`}
        >
            {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
    )
}
