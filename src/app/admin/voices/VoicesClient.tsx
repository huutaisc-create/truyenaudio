'use client'

import { saveVoiceManifest } from "@/actions/admin";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, GripVertical, Save, Mic2, AlertCircle } from "lucide-react";

type Voice = { id: string; name: string; path?: string };

const inputCls = "w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:bg-zinc-700 dark:border-zinc-600 dark:text-white focus:border-orange-500 focus:outline-none";

export default function VoicesClient({ initialVoices }: { initialVoices: Voice[] }) {
    const router = useRouter();
    const [voices, setVoices] = useState<Voice[]>(initialVoices);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState("");
    const [dirty, setDirty] = useState(false);

    function updateVoice(idx: number, field: keyof Voice, value: string) {
        setVoices(prev => prev.map((v, i) => i === idx ? { ...v, [field]: value } : v));
        setDirty(true);
    }

    function addVoice() {
        setVoices(prev => [...prev, { id: `voice-${Date.now()}`, name: 'Giọng mới', path: '' }]);
        setDirty(true);
    }

    function removeVoice(idx: number) {
        if (!confirm(`Xoá giọng "${voices[idx].name}"?`)) return;
        setVoices(prev => prev.filter((_, i) => i !== idx));
        setDirty(true);
    }

    function moveVoice(idx: number, dir: -1 | 1) {
        const newArr = [...voices];
        const target = idx + dir;
        if (target < 0 || target >= newArr.length) return;
        [newArr[idx], newArr[target]] = [newArr[target], newArr[idx]];
        setVoices(newArr);
        setDirty(true);
    }

    async function handleSave() {
        // Validate
        for (const v of voices) {
            if (!v.id.trim() || !v.name.trim()) {
                setError('ID và Tên không được để trống');
                return;
            }
        }
        const ids = voices.map(v => v.id);
        if (new Set(ids).size !== ids.length) {
            setError('ID bị trùng lặp');
            return;
        }

        setSaving(true);
        setError("");
        const res = await saveVoiceManifest(voices.map(v => ({
            id: v.id.trim(),
            name: v.name.trim(),
            ...(v.path?.trim() ? { path: v.path.trim() } : {}),
        }))) as any;
        setSaving(false);
        if (res?.error) {
            setError(res.error);
        } else {
            setSaved(true);
            setDirty(false);
            setTimeout(() => setSaved(false), 2500);
            router.refresh();
        }
    }

    return (
        <div className="space-y-4">
            {/* Voice list */}
            <div className="rounded-xl bg-white dark:bg-zinc-800 ring-1 ring-gray-900/5 dark:ring-white/10 divide-y divide-gray-100 dark:divide-zinc-700/50">
                {voices.length === 0 && (
                    <div className="p-8 text-center">
                        <Mic2 className="h-10 w-10 text-gray-300 dark:text-zinc-600 mx-auto mb-2" />
                        <p className="text-gray-400 text-sm">Chưa có giọng nào. Thêm giọng đầu tiên.</p>
                    </div>
                )}
                {voices.map((voice, idx) => (
                    <div key={idx} className="flex items-start gap-3 px-4 py-4">
                        {/* Order */}
                        <div className="flex flex-col gap-0.5 shrink-0 mt-2">
                            <button
                                type="button"
                                onClick={() => moveVoice(idx, -1)}
                                disabled={idx === 0}
                                className="text-gray-300 hover:text-gray-500 disabled:opacity-20 text-xs leading-none"
                            >▲</button>
                            <button
                                type="button"
                                onClick={() => moveVoice(idx, 1)}
                                disabled={idx === voices.length - 1}
                                className="text-gray-300 hover:text-gray-500 disabled:opacity-20 text-xs leading-none"
                            >▼</button>
                        </div>

                        {/* Fields */}
                        <div className="flex-1 grid grid-cols-1 gap-2 sm:grid-cols-3">
                            <div>
                                <label className="block text-[10px] text-gray-400 mb-1">ID (unique)</label>
                                <input
                                    value={voice.id}
                                    onChange={e => updateVoice(idx, 'id', e.target.value)}
                                    className={`${inputCls} font-mono text-xs`}
                                    placeholder="vd: vi-hoa-f"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] text-gray-400 mb-1">Tên hiển thị</label>
                                <input
                                    value={voice.name}
                                    onChange={e => updateVoice(idx, 'name', e.target.value)}
                                    className={inputCls}
                                    placeholder="vd: Giọng Hoa - Nữ"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] text-gray-400 mb-1">Path (folder/file, không đuôi)</label>
                                <input
                                    value={voice.path ?? ''}
                                    onChange={e => updateVoice(idx, 'path', e.target.value)}
                                    className={`${inputCls} font-mono text-xs`}
                                    placeholder="vd: vi-hoa-f/model"
                                />
                            </div>
                        </div>

                        {/* Delete */}
                        <button
                            type="button"
                            onClick={() => removeVoice(idx)}
                            className="text-red-400 hover:text-red-600 p-1 mt-1 shrink-0"
                        >
                            <Trash2 className="h-4 w-4" />
                        </button>
                    </div>
                ))}
            </div>

            {/* R2 path note */}
            <div className="flex gap-2 text-xs text-gray-500 dark:text-gray-400 bg-blue-50 dark:bg-blue-500/10 rounded-lg p-3 border border-blue-100 dark:border-blue-500/20">
                <AlertCircle className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                <div>
                    <p><strong>Cấu trúc file trên R2:</strong></p>
                    <p className="font-mono mt-0.5">models/custom/<em>path</em>.onnx</p>
                    <p className="font-mono">models/custom/<em>path</em>.onnx.json</p>
                    <p className="mt-1">Manifest được lưu tại: <span className="font-mono">models/custom/manifest.json</span></p>
                </div>
            </div>

            {error && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" />{error}
                </p>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={addVoice}
                    className="flex items-center gap-1.5 rounded-lg border-2 border-dashed border-gray-300 dark:border-zinc-600 px-4 py-2 text-sm text-gray-500 hover:border-orange-400 hover:text-orange-500 transition-colors"
                >
                    <Plus className="h-4 w-4" />
                    Thêm giọng
                </button>
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || !dirty}
                    className={`flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-medium transition-colors ${
                        saved ? 'bg-green-500 text-white' :
                        dirty ? 'bg-orange-500 text-white hover:bg-orange-600' :
                        'bg-gray-100 text-gray-400 cursor-default'
                    } disabled:opacity-60`}
                >
                    <Save className="h-4 w-4" />
                    {saving ? 'Đang lưu...' : saved ? 'Đã lưu manifest ✓' : 'Lưu manifest'}
                </button>
            </div>
        </div>
    );
}
