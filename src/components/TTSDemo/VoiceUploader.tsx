'use client';

import { useState } from 'react';

interface VoiceUploaderProps {
    onUploadSuccess: () => void;
}

export default function VoiceUploader({ onUploadSuccess }: VoiceUploaderProps) {
    const [name, setName] = useState('');
    const [onnxFile, setOnnxFile] = useState<File | null>(null);
    const [jsonFile, setJsonFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !onnxFile || !jsonFile) {
            setMessage({ type: 'error', text: 'Vui lòng điền đủ thông tin và chọn đủ 2 file.' });
            return;
        }

        setUploading(true);
        setMessage(null);

        const formData = new FormData();
        formData.append('name', name);
        formData.append('onnxFile', onnxFile);
        formData.append('jsonFile', jsonFile);

        try {
            const res = await fetch('/api/tts/voice-upload', {
                method: 'POST',
                body: formData,
            });

            const data = await res.json();

            if (data.success) {
                setMessage({ type: 'success', text: 'Upload thành công! Giọng mới đã được thêm.' });
                setName('');
                setOnnxFile(null);
                setJsonFile(null);
                // Reset file inputs visually if needed (simple way: rely on state or key reset)
                onUploadSuccess();
            } else {
                setMessage({ type: 'error', text: data.message || 'Upload thất bại.' });
            }
        } catch (err) {
            console.error(err);
            setMessage({ type: 'error', text: 'Lỗi kết nối server.' });
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 mt-8">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Thêm Giọng Đọc Mới</h3>

            <form onSubmit={handleUpload} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tên hiển thị:</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ví dụ: Giọng Nam Truyện Ma"
                        className="w-full p-2 border rounded-md"
                        disabled={uploading}
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">File Model (.onnx):</label>
                        <input
                            type="file"
                            accept=".onnx"
                            onChange={(e) => setOnnxFile(e.target.files?.[0] || null)}
                            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                            disabled={uploading}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">File Config (.json):</label>
                        <input
                            type="file"
                            accept=".json"
                            onChange={(e) => setJsonFile(e.target.files?.[0] || null)}
                            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                            disabled={uploading}
                        />
                    </div>
                </div>

                {message && (
                    <div className={`text-sm p-2 rounded ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {message.text}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={uploading}
                    className={`w-full py-2 px-4 rounded-md text-white font-semibold transition-colors ${uploading ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'
                        }`}
                >
                    {uploading ? 'Đang Upload...' : 'Tải Lên & Thêm Giọng'}
                </button>
            </form>
        </div>
    );
}
