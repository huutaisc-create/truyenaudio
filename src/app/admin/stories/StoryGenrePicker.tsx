'use client'

// Bộ chọn tag đa facet dùng chung cho form Tạo & Sửa truyện.
// - Checkbox theo 5 facet, lấy từ src/lib/taxonomy.ts (nguồn chân lý).
// - Mỗi facet submit bằng field riêng: genres/boiCanh/luuPhai/tinhCach/thiGiac.
// - Ô "Tìm và thêm": dán chuỗi meta → tự tick đúng facet, hiện token chưa nhận diện.
// - Giữ nguyên tag cũ ngoài taxonomy (đánh dấu "cũ") để không mất khi lưu.

import { useMemo, useState } from 'react'
import { Sparkles } from 'lucide-react'
import {
  FACET_ORDER, FACET_LABEL, TAXONOMY, classifyTokens, type FacetType,
} from '@/lib/taxonomy'

type Tag = { name: string; type: FacetType }

const FIELD: Record<FacetType, string> = {
  GENRE: 'genres',
  BOI_CANH: 'boiCanh',
  LUU_PHAI: 'luuPhai',
  TINH_CACH: 'tinhCach',
  THI_GIAC: 'thiGiac',
}

function emptySets(): Record<FacetType, Set<string>> {
  return { GENRE: new Set(), BOI_CANH: new Set(), LUU_PHAI: new Set(), TINH_CACH: new Set(), THI_GIAC: new Set() }
}

export default function StoryGenrePicker({ initial = [] }: { initial?: Tag[] }) {
  const [selected, setSelected] = useState<Record<FacetType, Set<string>>>(() => {
    const s = emptySets()
    initial.forEach(t => { if (s[t.type]) s[t.type].add(t.name) })
    return s
  })

  // Tag cũ nằm ngoài taxonomy → vẫn hiển thị (đánh dấu "cũ") để giữ khi lưu.
  const extras = useMemo(() => {
    const e: Record<FacetType, string[]> = { GENRE: [], BOI_CANH: [], LUU_PHAI: [], TINH_CACH: [], THI_GIAC: [] }
    initial.forEach(t => {
      if (e[t.type] && !TAXONOMY[t.type].includes(t.name) && !e[t.type].includes(t.name)) {
        e[t.type].push(t.name)
      }
    })
    return e
  }, [initial])

  const [pasteText, setPasteText] = useState('')
  const [report, setReport] = useState<{ added: number; ignored: string[]; unmatched: string[] } | null>(null)

  function toggle(type: FacetType, name: string) {
    setSelected(prev => {
      const next = { ...prev, [type]: new Set(prev[type]) }
      if (next[type].has(name)) next[type].delete(name); else next[type].add(name)
      return next
    })
  }

  function findAndAdd() {
    const { matched, ignored, unmatched } = classifyTokens(pasteText)
    setSelected(prev => {
      const next = emptySets()
      ;(Object.keys(prev) as FacetType[]).forEach(t => { next[t] = new Set(prev[t]) })
      matched.forEach(m => next[m.type].add(m.name))
      return next
    })
    setReport({ added: matched.length, ignored, unmatched })
  }

  const totalSelected = (Object.keys(selected) as FacetType[]).reduce((n, t) => n + selected[t].size, 0)

  return (
    <div className="space-y-4">
      {/* Tìm và thêm */}
      <div className="rounded-lg border border-orange-200 dark:border-orange-500/30 bg-orange-50/60 dark:bg-orange-500/10 p-3">
        <label className="block text-xs font-semibold text-orange-700 dark:text-orange-400 uppercase tracking-wide mb-1.5">
          Tìm và thêm nhanh — dán chuỗi thể loại
        </label>
        <textarea
          value={pasteText}
          onChange={e => setPasteText(e.target.value)}
          rows={2}
          placeholder="VD: Ngôn tình, Cổ đại, HE, Hào môn thế gia, Thị giác nữ chủ, Kim bài đề cử 🥇 …"
          className="block w-full rounded-md border border-gray-300 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
        />
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={findAndAdd}
            className="flex items-center gap-1.5 rounded-md bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-600"
          >
            <Sparkles className="h-3.5 w-3.5" /> Tìm và thêm
          </button>
          {report && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Đã tick <b className="text-emerald-600">{report.added}</b> tag
              {report.ignored.length > 0 && <> · bỏ {report.ignored.length}</>}
            </span>
          )}
        </div>
        {report && report.unmatched.length > 0 && (
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
            ⚠️ Chưa nhận diện (tick tay nếu cần): <b>{report.unmatched.join(', ')}</b>
          </p>
        )}
        {report && report.ignored.length > 0 && (
          <p className="mt-1 text-[11px] text-gray-400">Đã bỏ (rác/loại truyện): {report.ignored.join(', ')}</p>
        )}
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">Đã chọn <b className="text-brand-primary">{totalSelected}</b> tag</p>

      {/* Checkbox theo facet */}
      {FACET_ORDER.map(type => {
        const opts = [...TAXONOMY[type], ...extras[type]]
        return (
          <div key={type}>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{FACET_LABEL[type]}</label>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              {opts.map(name => {
                const isExtra = !TAXONOMY[type].includes(name)
                return (
                  <label key={name} className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-700/50 p-1 rounded transition-colors">
                    <input
                      type="checkbox"
                      name={FIELD[type]}
                      value={name}
                      checked={selected[type].has(name)}
                      onChange={() => toggle(type, name)}
                      className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                    />
                    <span>{name}{isExtra && <span className="text-[10px] text-amber-500"> (cũ)</span>}</span>
                  </label>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
