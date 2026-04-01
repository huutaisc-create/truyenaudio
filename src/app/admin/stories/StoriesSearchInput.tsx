'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'

export default function StoriesSearchInput({ defaultValue }: { defaultValue: string }) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [value, setValue] = useState(defaultValue)
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        setValue(defaultValue)
    }, [defaultValue])

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
        const q = e.target.value
        setValue(q)
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => {
            const params = new URLSearchParams(searchParams.toString())
            if (q) {
                params.set('query', q)
            } else {
                params.delete('query')
            }
            params.delete('page') // reset về trang 1
            router.push(`/admin/stories?${params.toString()}`)
        }, 350)
    }

    return (
        <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
                value={value}
                onChange={handleChange}
                placeholder="Tìm tên truyện hoặc tác giả..."
                className="w-full rounded-lg border border-gray-300 pl-10 pr-4 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none bg-white text-gray-900"
            />
        </div>
    )
}
