'use client'

import { createChaptersBulk, getExistingChapterIndexes } from "@/actions/admin";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, FolderOpen, CheckCheck, X, AlertTriangle } from "lucide-react";

type Row = {
    index: number;
    title: string;      // tên chương (có thể sửa)
    fileName: string;
    size: number;       // bytes
};

const INDEX_RE = /_(\d+)\.txt$/i;               // đuôi _NNNN.txt → index chuẩn
const CHUONG_RE = /Chương\s*\d+.*/i;  // "Chương N ..." → tên chương
const SMALL_BYTES = 800;                         // cảnh báo file quá nhỏ
const BATCH_MAX_ITEMS = 25;
const BATCH_MAX_BYTES = 700_000;                 // ~0.7MB / lần gọi server action

/** Tách tên chương từ tên file: bỏ .txt, bỏ đuôi _NNNN, lấy từ "Chương N" trở đi. */
function deriveTitle(fileName: string): string {
    let stem = fileName.replace(/\.txt$/i, '');
    stem = stem.replace(/_(\d+)$/i, '');           // bỏ _NNNN ở cuối
    const m = stem.match(CHUONG_RE);
    let title = (m ? m[0] : stem).trim();
    title = title.replace(/\s+/g, ' ').trim();
    return title;
}

export default function BulkChapterUpload({ storyId }: { storyId: string }) {
    const router = useRouter();
    const inputRef = useRef<HTMLInputElement>(null);
    const filesRef = useRef<Map<number, File>>(new Map());

    const [rows, setRows] = useState<Row[]>([]);
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [existing, setExisting] = useState<Set<number>>(new Set());
    const [overwrite, setOverwrite] = useState(false);
    const [filter, setFilter] = useState('');
    const [folderName, setFolderName] = useState('');
    const [skippedNames, setSkippedNames] = useState(0);

    const [loadingExisting, setLoadingExisting] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState({ done: 0, total: 0 });
    const [result, setResult] = useState<null | { created: number; updated: number; skipped: number; failed: { index: number; error: string }[] }>(null);
    const [error, setError] = useState('');

    async function refreshExisting() {
        setLoadingExisting(true);
        try {
            const idx = await getExistingChapterIndexes(storyId);
            setExisting(new Set(idx));
        } catch {
            setError('Không tải được danh sách chương hiện có.');
        } finally {
            setLoadingExisting(false);
        }
    }

    useEffect(() => { refreshExisting(); /* eslint-disable-next-line */ }, [storyId]);

    function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
        setResult(null);
        setError('');
        const fileList = Array.from(e.target.files || []);
        if (fileList.length === 0) return;

        const first = fileList[0] as File & { webkitRelativePath?: string };
        setFolderName(first.webkitRelativePath?.split('/')[0] || '');

        const map = new Map<number, File>();
        const parsed: Row[] = [];
        let skipped = 0;

        for (const f of fileList) {
            const name = f.name;
            if (!name.toLowerCase().endsWith('.txt')) { continue; }
            const m = name.match(INDEX_RE);
            if (!m) { skipped++; continue; }            // không có _NNNN.txt → bỏ (meta, map...)
            const index = parseInt(m[1], 10);
            if (map.has(index)) { continue; }           // trùng index → giữ file đầu
            map.set(index, f);
            parsed.push({ index, title: deriveTitle(name), fileName: name, size: f.size });
        }

        parsed.sort((a, b) => a.index - b.index);
        filesRef.current = map;
        setRows(parsed);
        setSkippedNames(skipped);

        // Mặc định chọn các chương MỚI (chưa có trong DB)
        const sel = new Set<number>();
        for (const r of parsed) if (!existing.has(r.index)) sel.add(r.index);
        setSelected(sel);
    }

    const filtered = useMemo(() => {
        const q = filter.trim().toLowerCase();
        if (!q) return rows;
        return rows.filter(r =>
            String(r.index).includes(q) || r.title.toLowerCase().includes(q)
        );
    }, [rows, filter]);

    const stats = useMemo(() => {
        let isNew = 0, exists = 0;
        for (const r of rows) { if (existing.has(r.index)) exists++; else isNew++; }
        return { total: rows.length, isNew, exists, selected: selected.size };
    }, [rows, existing, selected]);

    function toggle(index: number) {
        if (existing.has(index) && !overwrite) return; // không cho chọn chương đã có khi chưa bật ghi đè
        setSelected(prev => {
            const n = new Set(prev);
            if (n.has(index)) n.delete(index); else n.add(index);
            return n;
        });
    }

    function selectNew() {
        const n = new Set<number>();
        for (const r of rows) if (!existing.has(r.index)) n.add(r.index);
        setSelected(n);
    }
    function selectAll() {
        if (!overwrite) return selectNew();
        setSelected(new Set(rows.map(r => r.index)));
    }
    function clearSel() { setSelected(new Set()); }

    function editTitle(index: number, value: string) {
        setRows(prev => prev.map(r => r.index === index ? { ...r, title: value } : r));
    }

    function onToggleOverwrite(v: boolean) {
        setOverwrite(v);
        if (!v) {
            // bỏ chọn các chương đã có
            setSelected(prev => {
                const n = new Set<number>();
                for (const i of prev) if (!existing.has(i)) n.add(i);
                return n;
            });
        }
    }

    async function doUpload() {
        setError('');
        const targets = rows
            .filter(r => selected.has(r.index))
            .sort((a, b) => a.index - b.index);
        if (targets.length === 0) { setError('Chưa chọn chương nào.'); return; }

        setUploading(true);
        setResult(null);
        setProgress({ done: 0, total: targets.length });

        const agg = { created: 0, updated: 0, skipped: 0, failed: [] as { index: number; error: string }[] };
        let done = 0;

        try {
            let batch: { index: number; title: string; content: string }[] = [];
            let batchBytes = 0;

            const flush = async () => {
                if (batch.length === 0) return;
                const res = await createChaptersBulk(storyId, batch, overwrite) as {
                    error?: string; success?: boolean;
                    created?: number; updated?: number; skipped?: number;
                    failed?: { index: number; error: string }[];
                };
                if (res.error) {
                    for (const b of batch) agg.failed.push({ index: b.index, error: res.error });
                } else {
                    agg.created += res.created ?? 0;
                    agg.updated += res.updated ?? 0;
                    agg.skipped += res.skipped ?? 0;
                    agg.failed.push(...(res.failed ?? []));
                }
                done += batch.length;
                setProgress({ done, total: targets.length });
                batch = [];
                batchBytes = 0;
            };

            for (const r of targets) {
                const file = filesRef.current.get(r.index);
                if (!file) { agg.failed.push({ index: r.index, error: 'Không tìm thấy file' }); done++; setProgress({ done, total: targets.length }); continue; }
                let content = '';
                try { content = await file.text(); }
                catch { agg.failed.push({ index: r.index, error: 'Không đọc được file' }); done++; setProgress({ done, total: targets.length }); continue; }

                batch.push({ index: r.index, title: r.title, content });
                batchBytes += content.length;
                if (batch.length >= BATCH_MAX_ITEMS || batchBytes >= BATCH_MAX_BYTES) {
                    await flush();
                }
            }
            await flush();

            setResult(agg);
            await refreshExisting();
            // bỏ chọn các chương vừa upload thành công
            setSelected(new Set());
            router.refresh();
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Upload thất bại');
        } finally {
            setUploading(false);
        }
    }

    const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

    return (
        <div className="space-y-4">
            {/* Bộ chọn thư mục */}
            <div className="rounded-xl border border-dashed border-gray-300 dark:border-zinc-600 bg-gray-50 dark:bg-zinc-800/50 p-5">
                <div className="flex flex-wrap items-center gap-3">
                    <input
                        ref={inputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={handlePick}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        {...({ webkitdirectory: '', directory: '' } as any)}
                    />
                    <button
                        type="button"
                        onClick={() => inputRef.current?.click()}
                        disabled={uploading}
                        className="flex items-center gap-2 rounded-md bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
                    >
                        <FolderOpen className="h-4 w-4" /> Chọn thư mục chương…
                    </button>
                    {folderName && (
                        <span className="text-sm text-gray-600 dark:text-gray-300">
                            📁 <b>{folderName}</b> — {stats.total} chương
                            {skippedNames > 0 && <span className="text-gray-400"> (bỏ qua {skippedNames} file không phải chương)</span>}
                        </span>
                    )}
                </div>
                <p className="mt-2 text-xs text-gray-500">
                    Chọn thư mục chứa các file <code>.txt</code>. Số chương lấy từ đuôi <code>_NNNN.txt</code>, tên chương lấy từ phần &quot;Chương N …&quot; (có thể sửa trước khi upload).
                </p>
            </div>

            {rows.length > 0 && (
                <>
                    {/* Thanh công cụ */}
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-gray-600 dark:text-gray-300 mr-1">
                            Đã chọn <b className="text-brand-primary">{stats.selected}</b> / {stats.total}
                            <span className="text-emerald-600 ml-2">● {stats.isNew} mới</span>
                            <span className="text-amber-600 ml-2">● {stats.exists} đã có</span>
                        </span>
                        <div className="flex-1" />
                        <input
                            value={filter}
                            onChange={e => setFilter(e.target.value)}
                            placeholder="Tìm theo số / tên chương…"
                            className="rounded-md border border-gray-300 dark:border-zinc-600 dark:bg-zinc-700 px-3 py-1.5 text-sm"
                        />
                        <button type="button" onClick={selectNew} disabled={uploading}
                            className="rounded-md border border-emerald-300 text-emerald-700 dark:text-emerald-400 px-3 py-1.5 text-xs font-semibold hover:bg-emerald-50 dark:hover:bg-emerald-900/20">
                            Chọn tất cả (mới)
                        </button>
                        <button type="button" onClick={selectAll} disabled={uploading}
                            className="flex items-center gap-1 rounded-md border border-gray-300 dark:border-zinc-600 px-3 py-1.5 text-xs font-semibold hover:bg-gray-100 dark:hover:bg-zinc-700">
                            <CheckCheck className="h-3.5 w-3.5" /> Chọn tất cả
                        </button>
                        <button type="button" onClick={clearSel} disabled={uploading}
                            className="flex items-center gap-1 rounded-md border border-gray-300 dark:border-zinc-600 px-3 py-1.5 text-xs font-semibold hover:bg-gray-100 dark:hover:bg-zinc-700">
                            <X className="h-3.5 w-3.5" /> Bỏ chọn
                        </button>
                        <label className="flex items-center gap-1.5 rounded-md border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 cursor-pointer">
                            <input type="checkbox" checked={overwrite} onChange={e => onToggleOverwrite(e.target.checked)} disabled={uploading} />
                            Ghi đè chương đã có
                        </label>
                    </div>

                    {/* Bảng chương */}
                    <div className="max-h-[460px] overflow-auto rounded-xl border border-gray-200 dark:border-zinc-700">
                        <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-gray-100 dark:bg-zinc-800 text-left text-xs uppercase text-gray-500">
                                <tr>
                                    <th className="p-2 w-10"></th>
                                    <th className="p-2 w-16">Số</th>
                                    <th className="p-2">Tên chương</th>
                                    <th className="p-2 w-24">Dung lượng</th>
                                    <th className="p-2 w-28">Trạng thái</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(r => {
                                    const isExisting = existing.has(r.index);
                                    const disabled = isExisting && !overwrite;
                                    const checked = selected.has(r.index);
                                    const small = r.size < SMALL_BYTES;
                                    return (
                                        <tr key={r.index}
                                            className={`border-t border-gray-100 dark:border-zinc-700/60 ${checked ? 'bg-brand-primary/5' : ''} ${disabled ? 'opacity-50' : ''}`}>
                                            <td className="p-2 text-center">
                                                <input type="checkbox" checked={checked} disabled={disabled || uploading}
                                                    onChange={() => toggle(r.index)} />
                                            </td>
                                            <td className="p-2 font-mono text-gray-500">{r.index}</td>
                                            <td className="p-2">
                                                <input
                                                    value={r.title}
                                                    onChange={e => editTitle(r.index, e.target.value)}
                                                    disabled={uploading}
                                                    className="w-full rounded border border-transparent hover:border-gray-300 focus:border-brand-primary bg-transparent px-1.5 py-1 focus:outline-none dark:text-white"
                                                />
                                            </td>
                                            <td className="p-2">
                                                <span className={small ? 'text-red-500 font-semibold flex items-center gap-1' : 'text-gray-500'}>
                                                    {small && <AlertTriangle className="h-3.5 w-3.5" />}
                                                    {(r.size / 1024).toFixed(1)} KB
                                                </span>
                                            </td>
                                            <td className="p-2">
                                                {isExisting
                                                    ? <span className="rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 px-2 py-0.5 text-xs font-semibold">Đã có</span>
                                                    : <span className="rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 px-2 py-0.5 text-xs font-semibold">Mới</span>}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Tiến trình */}
                    {uploading && (
                        <div>
                            <div className="flex justify-between text-xs text-gray-500 mb-1">
                                <span>Đang upload… {progress.done}/{progress.total}</span>
                                <span>{pct}%</span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-zinc-700 overflow-hidden">
                                <div className="h-full bg-brand-primary transition-all" style={{ width: pct + '%' }} />
                            </div>
                        </div>
                    )}

                    {/* Kết quả */}
                    {result && (
                        <div className="rounded-lg border border-gray-200 dark:border-zinc-700 p-4 text-sm">
                            <p className="font-semibold text-gray-800 dark:text-gray-100">Kết quả upload</p>
                            <p className="mt-1 text-gray-600 dark:text-gray-300">
                                ✅ Thêm mới: <b>{result.created}</b> · ♻️ Ghi đè: <b>{result.updated}</b> · ⏭️ Bỏ qua: <b>{result.skipped}</b>
                                {result.failed.length > 0 && <> · ❌ Lỗi: <b className="text-red-600">{result.failed.length}</b></>}
                            </p>
                            {result.failed.length > 0 && (
                                <ul className="mt-2 max-h-32 overflow-auto text-xs text-red-600 list-disc pl-5">
                                    {result.failed.slice(0, 50).map((f, i) => <li key={i}>Chương {f.index}: {f.error}</li>)}
                                </ul>
                            )}
                        </div>
                    )}

                    {error && <p className="text-sm text-red-600">{error}</p>}

                    {/* Nút upload */}
                    <div className="flex justify-end pt-2">
                        <button
                            type="button"
                            onClick={doUpload}
                            disabled={uploading || loadingExisting || selected.size === 0}
                            className="flex items-center justify-center rounded-md bg-brand-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {uploading
                                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang upload…</>
                                : <>⬆ Upload {selected.size > 0 ? `${selected.size} chương` : ''}</>}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
