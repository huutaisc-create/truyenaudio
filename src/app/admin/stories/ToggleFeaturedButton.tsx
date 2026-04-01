'use client'

import { Star } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toggleFeaturedStory } from '@/actions/admin'

export default function ToggleFeaturedButton({ storyId, isFeatured }: { storyId: string; isFeatured: boolean }) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [featured, setFeatured] = useState(isFeatured)

    async function handleClick() {
        setLoading(true)
        setFeatured(f => !f)
        await toggleFeaturedStory(storyId, !featured)
        setLoading(false)
        router.refresh()
    }

    return (
        <button
            onClick={handleClick}
            disabled={loading}
            title={featured ? 'Đang ghim Hot — click để bỏ' : 'Ghim lên Hot trang chủ'}
            className={`transition-colors disabled:opacity-40 ${
                featured
                    ? 'text-yellow-500 hover:text-yellow-600'
                    : 'text-gray-300 hover:text-yellow-400'
            }`}
        >
            <Star className={`h-4 w-4 ${featured ? 'fill-yellow-400' : ''}`} />
        </button>
    )
}
