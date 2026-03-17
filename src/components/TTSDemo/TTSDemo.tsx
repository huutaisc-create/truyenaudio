'use client';

import { useState, useEffect, useRef } from 'react';
import { piper, PiperConfig } from '../../lib/Piper';
import VoiceUploader from './VoiceUploader';

interface CustomVoice {
  id: string;
  name: string;
  path: string;
}

export default function TTSDemo() {
  const [text, setText] = useState('Xin chào, đây là giọng đọc tiếng Việt được tạo ngay trên trình duyệt của bạn.');
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState('');

  // Voices state
  const [customVoices, setCustomVoices] = useState<CustomVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState('');

  const [ttsError, setTtsError] = useState<string | null>(null);

  // Audio queue management
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioQueueRef = useRef<Blob[]>([]);
  const isPlayingRef = useRef(false);

  // Advanced inference settings
  const [speed, setSpeed] = useState(1.0); // mapped to lengthScale (inverse or direct? Standard VITS: length_scale. < 1 is faster. > 1 is slower)
  // Let's make UI intuitive: Speed 1x = length 1.0. Speed 2x = length 0.5.
  const [noiseScale, setNoiseScale] = useState(0.667); // Default variation
  const [noiseW, setNoiseW] = useState(0.8); // Default stability

  const playNextChunk = () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return;

    const nextBlob = audioQueueRef.current.shift();
    if (!nextBlob) return;

    isPlayingRef.current = true;
    const nextUrl = URL.createObjectURL(nextBlob);

    if (audioRef.current) {
      audioRef.current.src = nextUrl;
      audioRef.current.play().catch(e => console.error("Play error:", e));

      audioRef.current.onended = () => {
        isPlayingRef.current = false;
        playNextChunk();
      };
    }
  };

  const fetchCustomVoices = async () => {
    try {
      // Add timestamp to prevent caching of manifest
      const res = await fetch('/models/custom/manifest.json?t=' + Date.now());
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setCustomVoices(data);
          return data;
        }
      }
    } catch (err) {
      console.warn('No custom manifest found or error fetching', err);
    }
    return [];
  };

  useEffect(() => {
    const init = async () => {
      setInitializing(true);
      try {
        const custom = await fetchCustomVoices();

        // Select first custom voice if available and nothing selected
        if (custom.length > 0 && !selectedVoice) {
          setSelectedVoice(custom[0].id);
        }
      } catch (e: any) {
        console.error("Init failed", e);
        setTtsError("Lỗi khởi tạo danh sách giọng đọc: " + e.message);
      } finally {
        setInitializing(false);
      }
    };
    init();

    // Cleanup on unmount
    return () => {
      piper.terminate();
    }
  }, []);

  const handleUploadSuccess = async () => {
    const newCustom = await fetchCustomVoices();
    if (newCustom.length > 0) {
      // Auto select the newest uploaded voice
      setSelectedVoice(newCustom[newCustom.length - 1].id);
    }
  };

  const handleSpeak = async () => {
    if (!text) return;
    if (!selectedVoice) {
      setTtsError("Vui lòng chọn hoặc upload một giọng đọc.");
      return;
    }

    setLoading(true);
    setProgress('Đang tạo âm thanh (Streaming)...');
    setAudioUrl(null); // Clear previous single file
    setTtsError(null);

    // Reset queue
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    try {
      let config: PiperConfig;
      const customVoice = customVoices.find(v => v.id === selectedVoice);
      if (customVoice) {
        const basePath = `/models/custom/${customVoice.path}`;
        config = {
          voiceId: customVoice.id,
          modelUrl: `${basePath}.onnx`,
          modelConfigUrl: `${basePath}.onnx.json`,
          inference: {
            lengthScale: 1 / speed, // 2x speed => 0.5 length
            noiseScale: noiseScale,
            noiseW: noiseW
          }
        };
      } else {
        throw new Error("Voice ID not found");
      }

      console.log("Speaking (Stream) with config:", config);

      await piper.speakStreaming(text, config, (blob) => {
        console.log("Received audio chunk:", blob.size);
        audioQueueRef.current.push(blob);
        playNextChunk();
        setProgress('Đang đọc...');
      });

      setProgress('Hoàn tất phát sinh!');

    } catch (err: any) {
      console.error("TTS Error:", err);
      // Only show error if we haven't started playing anything, mostly?
      if (!isPlayingRef.current && audioQueueRef.current.length === 0) {
        setTtsError(typeof err === 'string' ? err : err.message || 'Không thể tạo âm thanh');
      }
      setProgress('Lỗi!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="p-6 bg-white rounded-xl shadow-md space-y-4">
        <h2 className="text-2xl font-bold text-gray-800">Piper TTS Custom Client (Tiếng Việt)</h2>

        <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-800">
          <p>Phiên bản trực tiếp WASM (Không qua wrapper).</p>
          <p className="mt-1 font-bold">Lần đầu tiên sẽ tải model (~15-30MB).</p>
        </div>

        {ttsError && (
          <div className="bg-red-50 p-3 rounded text-red-600 text-sm">
            Lỗi: {ttsError}. Vui lòng kiểm tra console (F12).
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Chọn giọng đọc:</label>
          <select
            className="w-full p-2 border rounded mb-4"
            value={selectedVoice}
            onChange={(e) => setSelectedVoice(e.target.value)}
          >
            {customVoices.length === 0 && <option value="">-- Chưa có giọng đọc nào --</option>}

            {customVoices.length > 0 && (
              <optgroup label="Giọng Của Bạn (Upload)">
                {customVoices.map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </optgroup>
            )}
          </select>

          <label className="block text-sm font-medium text-gray-700 mb-2">Văn bản cần đọc:</label>
          <textarea
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 min-h-[100px]"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Nhập nội dung vào đây..."
          />
        </div>

        {/* Advanced Controls */}
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <h3 className="text-sm font-bold text-gray-700 mb-4 border-b pb-2">Cấu Hình Nâng Cao (Cảm Xúc/Tốc Độ)</h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Speed Control */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Tốc độ (Speed): {speed}x
              </label>
              <input
                type="range" min="0.5" max="2.0" step="0.1"
                value={speed} onChange={e => setSpeed(parseFloat(e.target.value))}
                className="w-full"
              />
              <p className="text-[10px] text-gray-500 mt-1">
                Tăng để đọc nhanh hơn. Giảm để đọc chậm, truyền cảm hơn.
              </p>
            </div>

            {/* Variation Control */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Biến thiên (Variation): {noiseScale}
              </label>
              <input
                type="range" min="0.1" max="1.0" step="0.05"
                value={noiseScale} onChange={e => setNoiseScale(parseFloat(e.target.value))}
                className="w-full"
              />
              <p className="text-[10px] text-gray-500 mt-1">
                Tăng để giọng có nhiều ngữ điệu ngẫu nhiên (bớt robot). Cao quá có thể bị méo.
              </p>
            </div>

            {/* Stability Control */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Ổn định (Stability): {noiseW}
              </label>
              <input
                type="range" min="0.1" max="1.0" step="0.05"
                value={noiseW} onChange={e => setNoiseW(parseFloat(e.target.value))}
                className="w-full"
              />
              <p className="text-[10px] text-gray-500 mt-1">
                Kiểm soát độ vang và ngắt nghỉ. Thấp = đều hơn. Cao = nhấn nhá hơn.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={handleSpeak}
            disabled={loading || initializing || !selectedVoice}
            className={`px-6 py-2 rounded-md font-semibold text-white transition-colors ${loading || initializing || !selectedVoice
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
              }`}
          >
            {loading ? 'Đang xử lý...' : 'Đọc ngay'}
          </button>

          {progress && <span className="text-sm text-gray-600">{progress}</span>}
        </div>

        <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200 animate-fade-in">
          <h3 className="text-sm font-bold text-gray-700 mb-2">Trình phát (Streaming):</h3>
          {/* Audio element for streaming playback */}
          <audio ref={audioRef} controls className="w-full mb-3" />
          <p className="text-xs text-gray-500 italic">Âm thanh sẽ được phát ngay khi từng câu được tạo xong.</p>
        </div>
      </div>

      <VoiceUploader onUploadSuccess={handleUploadSuccess} />
    </div>
  );
}
