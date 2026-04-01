'use client'

import { searchInStoryChapters, replaceInStoryChapters } from "@/actions/admin";
import { useState } from "react";
import { Search, Replace, AlertTriangle, CheckCircle2, ChevronDown, Loader2 } from "lucide-react";

type Story = { id: string; title: string; slug: string };
type SearchResult = { id: string; title: string; index: number; matchCount: number; preview: string };

const inputCls = "w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:bg-zinc-700 dark:border-zinc-600 dark:text-white focus:border-orange-500 focus:outline-none";

export default function BulkEditClient({ stories }: { stories: Story[] }) {
    const [storyId, setStoryId] = useState("");
    const [searchText, setSearchText] = useState("");
    const [replaceText, setReplaceText] = useState("");
    const [results, setResults] = useState<SearchResult[]>([]);
    const [totalChapters, setTotalChapters] = useState(0);
    const [searching, setSearching] = useState(false);
    const [replacing, setReplacing] = useState(false);
    const [replaceResult, setReplaceResult] = useState<{ replaced: number } | null>(null);
    const [error, setError] = useState("");
    const [searched, setSearched] = useState(false);

    async function handleSearch() {
        if (!storyId || !searchText.trim()) {
            setError("Vui lòng chọn truyện và nhập từ cần tìm");
            return;
        }
        setSearching(true);
        setError("");
        setResults([]);
        setReplaceResult(null);
        setSearched(false);
        const res = await searchInStoryChapters(storyId, searchText);
        setSearching(false);
        if ('error' in res) {
            setError(res.error as string);
        } else {
            setResults(res.results ?? []);
            setTotalChapters(res.totalChapters ?? 0);
            setSearched(true);
        }
    }

    async function handleReplace() {
        if (!storyId || !searchText.trim()) return;
        if (!confirm(`Thay thế "${searchText}" → "${replaceText}" trong ${results.length} chương?\n\nHành động này không thể hoàn tác!`)) return;
        setReplacing(true);
        setError("");
        setReplaceResult(null);
        const res = await replaceInStoryChapters(storyId, searchText, replaceText);
        setReplacing(false);
        if ('error' in res) {
            setError(res.error as string);
        } else {
            setReplaceResult({ replaced: res.replaced ?? 0 });
            setResults([]);
            setSearched(false);
        }
    }

    const selectedStory = stories.find(s => s.id === storyId);

    return (
        <div className="space-y-5">
            {/* Step 1: Chọn truyện */}
            <div className="rounded-xl bg-white dark:bg-zinc-800 ring-1 ring-gray-900/5 dark:ring-white/10 p-5 space-y-4">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-orange-500 text-white text-xs flex items-center justify-center font-bold">1</span>
                    Chọn truyện
                </h2>
                <div className="relative">
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    <select
                        value={storyId}
                        onChange={e => {
                            setStoryId(e.target.value);
                            setResults([]);
                            setSearched(false);
                            setReplaceResult(null);
                        }}
                        className={`${inputCls} appearance-none pr-8`}
                    >
                        <option value="">— Chọn truyện —</option>
                        {stories.map(s => (
                            <option key={s.id} value={s.id}>{s.title}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Step 2: Từ khoá */}
            <div className="rounded-xl bg-white dark:bg-zinc-800 ring-1 ring-gray-900/5 dark:ring-white/10 p-5 space-y-4">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-orange-500 text-white text-xs flex items-center justify-center font-bold">2</span>
                    Từ cần tìm & thay thế
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Tìm (find)</label>
                        <input
                            value={searchText}
                            onChange={e => { setSearchText(e.target.value); setSearched(false); setResults([]); setReplaceResult(null); }}
                            placeholder="Văn bản cần tìm..."
                            className={inputCls}
                            onKeyDown={e => e.key === 'Enter' && handleSearch()}
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Thay bằng (replace)</label>
                        <input
                            value={replaceText}
                            onChange={e => setReplaceText(e.target.value)}
                            placeholder="Văn bản thay thế (để trống = xoá)"
                            className={inputCls}
                        />
                    </div>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={handleSearch}
                        disabled={searching || !storyId || !searchText.trim()}
                        className="flex items-center gap-2 rounded-lg bg-gray-800 dark:bg-zinc-600 px-5 py-2 text-sm font-medium text-white hover:bg-gray-700 dark:hover:bg-zinc-500 disabled:opacity-50 transition-colors"
                    >
                        {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                        {searching ? 'Đang tìm...' : 'Tìm kiếm'}
                    </button>
                    <button
                        onClick={handleReplace}
                        disabled={replacing || !searched || results.length === 0}
                        className="flex items-center gap-2 rounded-lg bg-orange-500 px-5 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50 transition-colors"
                    >
                        {replacing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Replace className="h-4 w-4" />}
                        {replacing ? 'Đang thay thế...' : `Thay thế${results.length > 0 ? ` (${results.length} chương)` : ''}`}
                    </button>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 rounded-lg p-3 border border-red-200 dark:border-red-500/20">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    {error}
                </div>
            )}

            {/* Replace success */}
            {replaceResult && (
                <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-500/10 rounded-lg p-3 border border-green-200 dark:border-green-500/20">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    Đã thay thế thành công trong <strong>{replaceResult.replaced}</strong> chương.
                </div>
            )}

            {/* Search results */}
            {searched && (
                <div className="rounded-xl bg-white dark:bg-zinc-800 ring-1 ring-gray-900/5 dark:ring-white/10">
                    <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-zinc-700">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Kết quả: tìm thấy trong <span className="text-orange-500 font-bold">{results.length}</span> / {totalChapters} chương
                        </p>
                        {results.length > 0 && (
                            <span className="text-xs text-gray-400">
                                Tổng: {results.reduce((s, r) => s + r.matchCount, 0)} lần xuất hiện
                            </span>
                        )}
                    </div>

                    {results.length === 0 ? (
                        <div className="p-8 text-center text-gray-400 text-sm">
                            Không tìm thấy "{searchText}" trong bất kỳ chương nào.
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100 dark:divide-zinc-700/50 max-h-96 overflow-y-auto">
                            {results.map(r => (
                                <div key={r.id} className="px-5 py-3 hover:bg-gray-50 dark:hover:bg-zinc-700/30 transition-colors">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs font-mono text-gray-400 w-10 shrink-0">#{r.index}</span>
                                        <span className="text-sm font-medium text-gray-900 dark:text-white truncate flex-1">{r.title}</span>
                                        <span className="text-xs font-bold text-orange-500 shrink-0">{r.matchCount} lần</span>
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 pl-12 font-mono leading-relaxed">
                                        {r.preview.split(new RegExp(`(${searchText})`, 'gi')).map((part, i) =>
                                            part.toLowerCase() === searchText.toLowerCase()
                                                ? <mark key={i} className="bg-yellow-200 dark:bg-yellow-500/30 text-gray-900 dark:text-white rounded px-0.5">{part}</mark>
                                                : part
                                        )}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Warning */}
            {searched && results.length > 0 && (
                <div className="flex gap-2 text-xs text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-500/10 rounded-lg p-3 border border-yellow-200 dark:border-yellow-500/20">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                        <strong>Cảnh báo:</strong> Thao tác thay thế sẽ ghi đè trực tiếp lên R2 và <strong>không thể hoàn tác</strong>.
                        Hãy kiểm tra kỹ kết quả trước khi thực hiện.
                    </div>
                </div>
            )}
        </div>
    );
}
