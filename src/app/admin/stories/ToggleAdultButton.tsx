'use client'

import { ShieldAlert } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toggleStoryAdult } from '@/actions/admin'

/**
 * Bật/tắt cờ 18+ cho truyện.
 *
 * Bật lên thì app mobile sẽ làm mờ bìa + gắn nhãn 18+ ở danh sách, và chặn màn
 * nghe cho tới khi người dùng xác nhận đủ tuổi. Có hỏi xác nhận trước khi BẬT
 * (vì ảnh hưởng trực tiếp tới lượt đọc của truyện), tắt thì không hỏi.
 */
export default function ToggleAdultButton({ storyId, isAdult }: { storyId: string; isAdult: boolean }) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [adult, setAdult] = useState(isAdult)

    async function handleClick() {
        if (!adult) {
            const ok = confirm(
                'Đánh dấu truyện này là 18+?\n\n' +
                'Trên app: bìa truyện sẽ bị làm mờ kèm nhãn 18+, và người dùng phải ' +
                'xác nhận đủ 18 tuổi mới nghe được.'
            )
            if (!ok) return
        }
        setLoading(true)
        setAdult(a => !a)
        await toggleStoryAdult(storyId, !adult)
        setLoading(false)
        router.refresh()
    }

    return (
        <button
            onClick={handleClick}
            disabled={loading}
            title={adult ? 'Đang gắn 18+ — click để bỏ' : 'Đánh dấu 18+ (mờ bìa + chặn tuổi)'}
            className={`transition-colors disabled:opacity-40 ${
                adult
                    ? 'text-rose-600 hover:text-rose-700'
                    : 'text-gray-300 hover:text-rose-400'
            }`}
        >
            <ShieldAlert className="h-4 w-4" />
        </button>
    )
}
