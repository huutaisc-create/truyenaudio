'use client'

// Bộ chọn tag đa facet dùng chung cho form Tạo & Sửa truyện.
// - Checkbox theo các nhóm trong src/lib/taxonomy.ts (nguồn chân lý, data-driven).
// - Mỗi nhóm submit bằng field FACET_PARAM[type].
// - Ô "Tìm và thêm": dán chuỗi meta → tự tick đúng nhóm.
// - Mỗi nhóm có ô "+ Thêm tag" để admin tự thêm tag mới khi cần.
// - Giữ tag cũ ngoài taxonomy (đánh dấu "thêm") để không mất khi lưu.

import { useMemo, useState } from 'react'
import { Sparkles, Plus } from 'lucide-react'
import {
  FACET_ORDER, FACET_LABEL, FACET_PARAM, TAXONOMY, classifyTokens, type FacetType,
} from '@/lib/taxonomy'

type Tag = { name: string; type: FacetType }

function emptySets(): Record<FacetType, Set<string>> {
  return Object.fromEntries(FACET_ORDER.map(f => [f, new Set<string>()])) as Record<FacetType, Set<string>>
}
function emptyArrays(): Record<FacetType, string[]> {
  return Object.fromEntries(FACET_ORDER.map(f => [f, [] as string[]])) as Record<FacetType, string[]>
}
function emptyStrings(): Record<FacetType, string> {
  return Object.fromEntries(FACET_ORDER.map(f => [f, ''])) as Record<FacetType, string>
}

export default function StoryGenrePicker({ initial = [] }: { initial?: Tag[] }) {
  const [selected, setSelected] = useState<Record<FacetType, Set<string>>>(() => {
    const s = emptySets()
    initial.forEach(t => { if (s[t.type]) s[t.type].add(t.name) })
    return s
  })

  // Tag cũ ngoài taxonomy (từ dữ liệu truyện) → vẫn hiển thị để giữ khi lưu.
  const initialExtras = useMemo(() => {
    const e = emptyArrays()
    initial.forEach(t => {
      if (e[t.type] && !TAXONOMY[t.type].includes(t.name) && !e[t.type].includes(t.name)) e[t.type].push(t.name)
    })
    return e
  }, [initial])

  // Tag admin tự thêm mới (chưa có trong taxonomy) theo từng nhóm.
  const [customExtras, setCustomExtras] = useState<Record<FacetType, string[]>>(emptyArrays)
  const [customInput, setCustomInput] = useState<Record<FacetType, string>>(emptyStrings)

  const [pasteText, setPasteText] = useState('')
  const [report, setReport] = useState<{ added: number; ignored: string[]; unmatched: string[] } | null>(null)

  function toggle(type: FacetType, name: string) {
    setSelected(prev => {
      const next = { ...prev, [type]: new Set(prev[type]) }
      if (next[type].has(name)) next[type].delete(name); else next[type].add(name)
      return next
    })
  }

  function addCustom(type: FacetType) {
    const name = (customInput[type] || '').trim()
    if (!name) return
    setCustomExtras(prev => prev[type].includes(name) ? prev : { ...prev, [type]: [...prev[type], name] })
    setSelected(prev => { const n = { ...prev, [type]: new Set(prev[type]) }; n[type].add(name); return n })
    setCustomInput(prev => ({ ...prev, [type]: '' }))
  }

  function findAndAdd() {
    const { matched, ignored, unmatched } = classifyTokens(pasteText)
    setSelected(prev => {
      const next = emptySets()
      FACET_ORDER.forEach(t => { next[t] = new Set(prev[t]) })
      matched.forEach(m => next[m.type].add(m.name))
      return next
    })
    setReport({ added: matched.length, ignored, unmatched })
  }

  const totalSelected = FACET_ORDER.reduce((n, t) => n + selected[t].size, 0)

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
          placeholder="VD: Cổ đại, Ngôn tình, Hệ thống, Thị giác nữ chủ, HE …"
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
            ⚠️ Chưa nhận diện (tick tay hoặc thêm ở nhóm phù hợp): <b>{report.unmatched.join(', ')}</b>
          </p>
        )}
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">Đã chọn <b className="text-brand-primary">{totalSelected}</b> tag</p>

      {FACET_ORDER.map(type => {
        const opts = [...TAXONOMY[type], ...initialExtras[type], ...customExtras[type]]
        return (
          <div key={type}>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{FACET_LABEL[type]}</label>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              {opts.map(name => {
                const isStd = TAXONOMY[type].includes(name)
                return (
                  <label key={name} className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-700/50 p-1 rounded transition-colors">
                    <input
                      type="checkbox"
                      name={FACET_PARAM[type]}
                      value={name}
                      checked={selected[type].has(name)}
                      onChange={() => toggle(type, name)}
                      className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                    />
                    <span>{name}{!isStd && <span className="text-[10px] text-amber-500"> (thêm)</span>}</span>
                  </label>
                )
              })}
            </div>
            {/* Ô thêm tag mới cho nhóm này */}
            <div className="mt-1.5 flex items-center gap-1.5">
              <input
                value={customInput[type]}
                onChange={e => setCustomInput(prev => ({ ...prev, [type]: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom(type) } }}
                placeholder={`+ Thêm tag vào ${FACET_LABEL[type]}…`}
                className="flex-1 rounded border border-dashed border-gray-300 dark:border-zinc-600 bg-transparent px-2 py-1 text-xs focus:border-orange-500 focus:outline-none dark:text-white"
              />
              <button
                type="button"
                onClick={() => addCustom(type)}
                className="flex items-center gap-1 rounded border border-gray-300 dark:border-zinc-600 px-2 py-1 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700"
              >
                <Plus className="h-3 w-3" /> Thêm
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
