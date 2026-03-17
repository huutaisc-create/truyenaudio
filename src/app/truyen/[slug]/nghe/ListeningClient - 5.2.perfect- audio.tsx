// ─── Version: 4.8.2 ──────────────────────────────────────────────────────────
// Changelog:
//   4.8.2 — Fix sentenceTotal hiển thị partial thay vì tổng thực:
//            dùng snapshotTotal thay vì đọc lại prefetchTotalRef (đã bị reset = 0)
//   4.8.1 — Fix goToChapter (done case): spawn lại workers sau stopAll
//            để pollFromBuffer có thể trigger prefetch ch+2 (trước đây ABORT: worker pool empty)
//   4.2 — Fix hoàn chỉnh resume prefetch khi click chương đang generate ngầm:
//          - goToChapter: snapshot PCM buffer TRƯỚC stopAll, restore sau
//          - goToChapter (partial): spawn lại workers mới, gọi prefetchNextChapter resume
//          - prefetchNextChapter: detect isResume (cùng id + có chunks + chưa done)
//            → KHÔNG reset buffer, KHÔNG fetch lại, KHÔNG phonemize lại phần đã có
//            → nextTask = resumeFromIndex, pcmBuffer giữ phần đã có
//            → generate tiếp từ chunk còn thiếu, push vào prefetchedPCMRef
//          - pollNewChunks trong playFromPrefetchBuffer tự schedule các chunks mới
//   4.1 — Fix goToChapter khi click chương đang prefetch (chưa done) [partial, workers chết]:
//          Root cause: stopAll() xóa sạch prefetch refs trước khi goToChapter
//          kịp dùng chúng. Fix: snapshot toàn bộ prefetch state TRƯỚC stopAll,
//          restore lại sau stopAll để playFromPrefetchBuffer nhận đúng buffer.
//          - isPrefetching / isPrefetchDone check TRƯỚC stopAll
//          - snapshot {chap, pcm[], done, id} → restore sau stopAll
//          - prefetchStopRef=false để prefetch ngầm tiếp tục generate chunks còn lại
//          - sentenceTotal set ngay với số chunks đang có (không để 0)
//          - playFromPrefetchBuffer: set sentenceTotal partial ngay từ đầu
//
// Changelog (cũ):
//   3.2 — Fix playFromPrefetchBuffer: thay vì gọi streamChapter lại từ đầu khi
//          prefetch chưa xong, poll schedule chunks mới từ prefetchedPCMRef khi
//          prefetch generate thêm — không generate lại, không delay
//
//          ── Flow chi tiết ──
//          Chương 1 (streamChapter):
//            1. Generate chunks → play khi đủ BUFFER_AHEAD
//            2. Generate xong (pipelineDone=true) → trigger prefetch chương 2 ngay
//            3. Prefetch chương 2 chạy ngầm song song với audio đang phát
//            4. Audio hết chương 1 → xét 2 case:
//               Case A — prefetch chương 2 Done:
//                 - Play toàn bộ buffer chương 2 ngay
//                 - Đồng thời trigger prefetch chương 3
//               Case B — prefetch chương 2 chưa Done:
//                 - Play chunks đã có ngay (dù chỉ 10/108 chunks)
//                 - Poll schedule chunks mới vào AudioContext khi prefetch generate thêm
//                 - Khi generate xong chương 2 → trigger prefetch chương 3
//          Chương 2, 3, 4... (playFromPrefetchBuffer):
//            - Lặp lại y chang pattern trên
//            - Không restart RAM ở bất kỳ đâu
//   3.1 — Bỏ restart workers; trigger prefetch sớm tại BUFFER_AHEAD (workers còn
//          model cached); playFromPrefetchBuffer play ngay chunks đã có, nếu
//          prefetch chưa xong thì stream tiếp seamless — không chờ Done
//   3.0 — Fix race condition selectedVoice='': pollFromBuffer gọi prefetchNextChapter
//          qua prefetchNextChapterRef.current thay vì trực tiếp (closure stale)
//   2.9 — Fix SKIP bug: bỏ check prefetchingIdRef===id trong prefetchNextChapter,
//          chỉ giữ check prefetchDoneRef. Root cause: finally set prefetchingIdRef
//          trước khi gọi → prefetchNextChapter SKIP ngay lập tức
//   2.8 — Bỏ trigger prefetch trong pollPlayed (dùng workers cũ trước restart),
//          chỉ trigger trong finally sau restart; reset prefetchingIdRef=null
//          nếu bị set sớm từ pollPlayed
//   2.7 — Đổi tất cả prefix log thành [W:...] để filter [W thấy được
//   2.6 — Log chi tiết [Step1][Step2][Step3], fix audioHandledRef=true bị thiếu
//   1.7 — Kick pollPlayed sau restart workers, reset audioHandled
//   1.6 — Verbose poll log, fix prefetch trigger condition
//   1.5 — Fix stopFlagRef block pollPlayed sau restart workers
//   1.4 — Debug pollPlayed stop reason
//   1.3 — Restart workers sau mỗi chương để clear ONNX memory, version badge UI
//   1.2 — audioHandled flag tránh audioEmpty trigger nhiều lần, log prefetch id
//   1.1 — Debug logs chi tiết infer timing, auto-next log, prefetchStopRef fix
//   1.0 — Baseline: prefetch song song, +/- worker buttons, loading overlay
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Headphones, SkipBack, SkipForward,
  Play, Pause, RotateCcw, RotateCw, ChevronDown,
  CheckCircle2, List,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────
interface Chapter {
  id: string;
  index: number;
  title: string;
  content: string;
}
interface ChapterMeta {
  id: string;
  index: number;
  title: string;
}
interface Props {
  slug: string;
  storyTitle: string;
  storyCover: string | null;
  author: string;
  totalChapters: number;
  allChapters: ChapterMeta[];
  initialChapterIndex: number;
  initialChapter: Chapter;
}

// ─── Helpers ──────────────────────────────────────────────
function cleanTitle(title: string, index: number): string {
  return title
    .replace(new RegExp(`^C${index}\s+`, 'i'), '')   // bỏ "C3 "
    .replace(/^Chương\s*\d+\s*/i, '')               // bỏ "Chương 3 "
    .trim();
}

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}
const MIN_SPEED = 0.7;
const MAX_SPEED = 2.0;
const SPEED_STEP = 0.05;
const PAGE_SIZE = 20;

// ─── Wave Icon ─────────────────────────────────────────────
function WaveIcon() {
  return (
    <div className="flex items-center gap-[2px] h-3 shrink-0">
      {[0, 150, 300, 450].map((delay, i) => (
        <span key={i} className="w-[2px] rounded-sm bg-[#e8580a] animate-bounce"
          style={{ animationDelay: `${delay}ms`, height: i % 2 === 0 ? '6px' : '12px' }} />
      ))}
    </div>
  );
}

// ─── Loading Overlay ──────────────────────────────────────
function LoadingOverlay({ chapterTitle, sentenceGenerated, sentenceTotal }: {
  chapterTitle: string;
  sentenceGenerated: number;
  sentenceTotal: number;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0f0d0a]/90 backdrop-blur-md">
      {/* Sóng âm */}
      <div className="flex items-center gap-[5px] mb-8" style={{ height: 60 }}>
        {[20,40,55,35,50,60,45,55,30,50,40,22].map((h, i) => (
          <span key={i} className="w-[4px] rounded-full bg-gradient-to-t from-[#e8580a] to-[#ff9f5a]"
            style={{
              height: h,
              animation: 'waveDance 1.2s ease-in-out infinite',
              animationDelay: `${i * 0.1}s`,
              boxShadow: '0 0 10px rgba(232,88,10,0.4)',
            }} />
        ))}
      </div>

      {/* Label */}
      <p className="text-[11px] font-black tracking-[.15em] uppercase text-[#e8580a] mb-3">
        Đang tạo audio
      </p>

      {/* Chapter title */}
      <p className="font-serif text-[15px] text-[#f0ebe4] text-center px-8 leading-snug mb-6 max-w-sm">
        {chapterTitle}
      </p>

      {/* Progress dots + text */}
      <div className="flex items-center gap-2 mb-3">
        {[0, 0.2, 0.4].map((delay, i) => (
          <span key={i} className="w-[6px] h-[6px] rounded-full bg-[#e8580a]"
            style={{ animation: 'dotPulse 1.4s ease-in-out infinite', animationDelay: `${delay}s` }} />
        ))}
        <span className="text-[11px] text-[#8a7e72] font-medium ml-1">Vui lòng chờ trong giây lát</span>
      </div>

      {/* Counter */}
      <p className="text-[11px] text-[#8a7e72] font-medium tabular-nums">
        Đang xử lý câu {sentenceGenerated} / {sentenceTotal > 0 ? sentenceTotal : '...'}
      </p>

      <style>{`
        @keyframes waveDance {
          0%, 100% { transform: scaleY(0.3); opacity: 0.5; }
          50%       { transform: scaleY(1);   opacity: 1;   }
        }
        @keyframes dotPulse {
          0%, 100% { transform: scale(0.6); opacity: 0.3; }
          50%       { transform: scale(1.2); opacity: 1;   }
        }
      `}</style>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────
export default function ListeningClient({
  slug, storyTitle, storyCover, author,
  totalChapters, allChapters, initialChapterIndex, initialChapter,
}: Props) {
  const router = useRouter();

  // ── Audio engine refs ──
  const actxRef      = useRef<AudioContext | null>(null);
  const nextStartRef = useRef<number>(0);
  const stopFlagRef  = useRef<boolean>(false);
  const speedRef     = useRef<number>(1);

  // ── Player state ──
  const [isPlaying,         setIsPlaying]         = useState(false);
  const [speed,             setSpeed]              = useState(1.0);
  const [isGenerating,      setIsGenerating]       = useState(false);

  // ── Debug state ──
  const [sentencePlayed,    setSentencePlayed]    = useState(0);
  const [sentenceGenerated, setSentenceGenerated] = useState(0);
  const [sentenceTotal,     setSentenceTotal]     = useState(0);
  const [ramMB,             setRamMB]             = useState<number | null>(null);

  // ── Chapter state ──
  const [currentChapter,    setCurrentChapter]    = useState<Chapter>(initialChapter);
  const [loadedChapters,    setLoadedChapters]    = useState<Record<number, Chapter>>({
    [initialChapter.index]: initialChapter,
  });
  const [completedChapters, setCompletedChapters] = useState<Set<number>>(new Set());

  // ── Voice state ──
  const [voices,        setVoices]       = useState<{ id: string; name: string; path?: string }[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [showVoiceMenu, setShowVoiceMenu] = useState(false);

  // ── Worker settings ──
  const [showWorkerPanel, setShowWorkerPanel] = useState(false);
  const [workerCount,     setWorkerCount]     = useState(2); // mặc định 2
  const [hwInfo, setHwInfo] = useState<{ cores: number; ram: number; isMT: boolean } | null>(null);

  // ── Chapter list UI ──
  const [showChapterList,   setShowChapterList]   = useState(false);
  const [mobileVisible,     setMobileVisible]     = useState(PAGE_SIZE);
  const [desktopVisible,    setDesktopVisible]    = useState(PAGE_SIZE);
  const chapListRef        = useRef<HTMLDivElement>(null);
  const activeChapRef      = useRef<HTMLDivElement>(null);
  const mobileSentinelRef  = useRef<HTMLDivElement>(null);
  const desktopSentinelRef = useRef<HTMLDivElement>(null);


  const currentIdx     = currentChapter.index;
  const sortedChapters = [...allChapters].sort((a, b) => a.index - b.index);
  const hasPrev        = sortedChapters.some(c => c.index < currentIdx);
  const hasNext        = sortedChapters.some(c => c.index > currentIdx);

  // ── Detect hardware info khi mount ──
  useEffect(() => {
    const cores = navigator.hardwareConcurrency ?? 2;
    const ram   = (navigator as any).deviceMemory ?? 4;
    const isMT  = typeof self !== 'undefined' && (self as any).crossOriginIsolated === true;
    const maxByRam  = Math.max(1, Math.floor((ram * 1024 * 0.3) / 70));
    const maxByCore = Math.max(1, Math.floor(cores / 2));
    const autoMax   = Math.min(maxByRam, maxByCore, 4);
    setHwInfo({ cores, ram, isMT });
    // Auto set về max nếu mặc định 2 vượt quá giới hạn
    setWorkerCount(w => Math.max(2, Math.min(w, Math.max(2, autoMax))));
  }, []);

  // ── Load voice manifest ──
  useEffect(() => {
    fetch('/models/custom/manifest.json')
      .then(r => r.json())
      .then((data: { id: string; name: string; path?: string }[]) => {
        setVoices(data);
        if (data.length > 0) setSelectedVoice(data[0].id);
      })
      .catch(() => {
        setVoices([{ id: 'default', name: 'Giọng mặc định' }]);
        setSelectedVoice('default');
      });
  }, []);

  // ── Sync speedRef ──
  useEffect(() => { speedRef.current = speed; }, [speed]);

  // ── Media Session ──
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentChapter.title || `Chương ${currentIdx}`,
      artist: author, album: storyTitle,
      artwork: storyCover ? [{ src: storyCover, sizes: '512x512', type: 'image/jpeg' }] : [],
    });
    navigator.mediaSession.setActionHandler('previoustrack', () => goChapter('prev'));
    navigator.mediaSession.setActionHandler('nexttrack',     () => goChapter('next'));
  }, [currentChapter]);

  // ── Scroll active chapter vào view ──
  useEffect(() => {
    if (showChapterList) {
      const curPos = sortedChapters.findIndex(c => c.index === currentIdx);
      // Đảm bảo active chapter nằm trong range đã render
      setMobileVisible(prev => Math.max(prev, curPos + 5));
      setTimeout(() => {
        activeChapRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 80);
    }
  }, [showChapterList]);

  // ── Scroll active chapter trên desktop vào view khi mount ──
  useEffect(() => {
    const curPos = sortedChapters.findIndex(c => c.index === currentIdx);
    setDesktopVisible(prev => Math.max(prev, curPos + 5));
  }, [currentIdx]);

  // ── IntersectionObserver: mobile drawer ──
  useEffect(() => {
    const el = mobileSentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting)
        setMobileVisible(prev => Math.min(prev + PAGE_SIZE, sortedChapters.length));
    }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [showChapterList, sortedChapters.length]);

  // ── IntersectionObserver: desktop panel ──
  useEffect(() => {
    const el = desktopSentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting)
        setDesktopVisible(prev => Math.min(prev + PAGE_SIZE, sortedChapters.length));
    }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [sortedChapters.length]);

  // ─────────────────────────────────────────────────────────
  // ── Audio core ──
  // ─────────────────────────────────────────────────────────
  const getActx = useCallback(() => {
    if (!actxRef.current || actxRef.current.state === 'closed') {
      actxRef.current = new AudioContext();
      nextStartRef.current = 0;
    }
    if (actxRef.current.state === 'suspended') actxRef.current.resume();
    return actxRef.current;
  }, []);

  const stopAll = useCallback(() => {
    stopFlagRef.current = true;
    if (actxRef.current && actxRef.current.state !== 'closed') {
      actxRef.current.close();
      actxRef.current = null;
    }
    nextStartRef.current = 0;
    setIsPlaying(false);
    setIsGenerating(false);
    // Terminate toàn bộ worker pool
    for (const w of workerPoolRef.current) {
      try { w?.terminate(); } catch {}
    }
    workerPoolRef.current = [];
    piperRef.current = null;
    // Dọn prefetch state — tránh rác khi chuyển chương bất ngờ
    prefetchedPCMRef.current  = [];
    prefetchDoneRef.current   = false;
    prefetchedChapRef.current = null;
    prefetchingIdRef.current  = null;
    prefetchStopRef.current   = true;
    prefetchTotalRef.current  = 0;
  }, []);

  // trimSilence: cắt bỏ silence ở đầu/cuối PCM
  // threshold: sample phải vượt mức này mới tính là "có âm thanh"
  // margin: giữ lại vài ms để tránh click artifact
  const trimSilence = useCallback((pcm: Float32Array, sampleRate: number, thresholdDb = -45): Float32Array => {
    const threshold = Math.pow(10, thresholdDb / 20); // -45dB ≈ 0.006
    const marginSamples = Math.floor(sampleRate * 0.003); // 3ms margin
    let start = 0;
    let end   = pcm.length - 1;
    while (start < pcm.length && Math.abs(pcm[start]) < threshold) start++;
    while (end > start && Math.abs(pcm[end]) < threshold) end--;
    start = Math.max(0, start - marginSamples);
    end   = Math.min(pcm.length - 1, end + marginSamples);
    const trimmedMs = ((pcm.length - (end - start + 1)) / sampleRate * 1000).toFixed(0);
    if (Number(trimmedMs) > 50) console.log(`[Trim] removed=${trimmedMs}ms original=${(pcm.length/sampleRate*1000).toFixed(0)}ms`);
    return pcm.slice(start, end + 1);
  }, []);

  // schedulePCM: nhận raw PCM Float32Array → tạo AudioBuffer → schedule
  // pauseMs: khoảng nghỉ tự nhiên sau chunk (ms) — context-aware
  const schedulePCM = useCallback((
    actx: AudioContext,
    pcm: Float32Array,
    sampleRate: number,
    isClauseBoundary = false,
    pauseMs = 150,
  ): number => {
    try {
      // Không trim silence — Piper tự generate silence đúng chỗ
      const audioBuffer = actx.createBuffer(1, pcm.length, sampleRate);
      const channel = audioBuffer.getChannelData(0);
      channel.set(pcm);

      const s       = speedRef.current;
      const startAt = Math.max(actx.currentTime, nextStartRef.current);

      // Fade-in 10ms đầu chunk + fade-out 10ms cuối chunk — giảm click/pop
      const endAt    = startAt + audioBuffer.duration / s;
      const gainNode = actx.createGain();
      gainNode.connect(actx.destination);
      // Fade-in: luôn apply để tránh click khi chunk bắt đầu
      gainNode.gain.setValueAtTime(0, startAt);
      gainNode.gain.linearRampToValueAtTime(1, startAt + 0.01); // 10ms fade in
      // Fade-out: 10ms trước khi chunk kết thúc
      gainNode.gain.setValueAtTime(1, Math.max(startAt + 0.01, endAt - 0.01));
      gainNode.gain.linearRampToValueAtTime(0, endAt);

      const source = actx.createBufferSource();
      source.buffer             = audioBuffer;
      source.playbackRate.value = s;
      source.connect(gainNode);
      source.start(startAt);
      // Disconnect sau khi play xong — tránh memory leak trên chapter dài
      source.onended = () => { source.disconnect(); gainNode.disconnect(); };

      // Pause tự nhiên sau chunk — chia cho speed vì audio chạy nhanh hơn
      const pauseSec = (pauseMs / 1000) / s;
      nextStartRef.current = startAt + audioBuffer.duration / s + pauseSec;

      return nextStartRef.current;
    } catch {
      return nextStartRef.current;
    }
  }, [trimSilence]);

  // scheduleChunk legacy — backward compat nếu cần
  const scheduleChunk = useCallback(async (actx: AudioContext, wavBlob: Blob): Promise<number> => {
    try {
      const arrayBuffer = await wavBlob.arrayBuffer();
      const audioBuffer = await actx.decodeAudioData(arrayBuffer);
      const s           = speedRef.current;
      const source      = actx.createBufferSource();
      source.buffer             = audioBuffer;
      source.playbackRate.value = s;
      source.connect(actx.destination);
      const startAt = Math.max(actx.currentTime, nextStartRef.current);
      source.start(startAt);
      nextStartRef.current = startAt + audioBuffer.duration / s;
      return nextStartRef.current;
    } catch {
      return nextStartRef.current;
    }
  }, []);

  // ── Pipeline refs ──
  const endTimesRef      = useRef<number[]>([]);
  const generatedRef     = useRef<number>(0);
  const pipelineDone     = useRef<boolean>(false);
  const audioHandledGlobalRef  = useRef<boolean>(false); // guard chung cho pollPlayed + pollFromBuffer — tránh double auto-next
  const activeChapIndexRef     = useRef<number>(-1);     // index chương đang active — pollPlayed/pollFromBuffer stale tự dừng
  const streamChapterRef            = useRef<((ch: Chapter) => Promise<void>) | null>(null);
  const playFromPrefetchBufferRef   = useRef<((ch: Chapter) => void) | null>(null);
  const piperRef         = useRef<any>(null); // giữ worker sống → không load lại model mỗi chương
  const workerPoolRef    = useRef<any[]>([]);  // pool nhiều worker theo phần cứng
  const workerCountRef   = useRef<number>(1);  // số worker thực tế dùng

  const BUFFER_AHEAD = 4;

  // ── Prefetch chương tiếp theo ──
  const prefetchedChapRef    = useRef<Chapter | null>(null);      // chapter metadata
  const prefetchedPCMRef     = useRef<Array<{ pcm: Float32Array; sampleRate: number; isClause: boolean; pauseMs: number }>>([]);
  const prefetchDoneRef      = useRef<boolean>(false);
  const prefetchingIdRef     = useRef<string | null>(null);
  const prefetchNextChapterRef = useRef<((meta: { id: string; index: number; title: string }) => void) | null>(null);
  const prefetchStopRef      = useRef<boolean>(false);
  const prefetchTotalRef     = useRef<number>(0);  // tổng chunks của chương đang prefetch — biết ngay sau splitChunks

  // detectWorkerCount đọc từ state workerCount (do user chọn)
  const detectWorkerCount = useCallback(() => workerCount, [workerCount]);

  // ── Sub-sentence splitter ──
  // Target 40-80 chars/chunk — sweet spot VITS inference latency
  // Từ nối quan trọng → pause dài hơn
  const CONNECTORS = /^(nhưng|tuy nhiên|vì vậy|do đó|tuy vậy|mặc dù|thế nhưng|bởi vì|vì thế|cho nên)/i;

  // Đếm số từ tiếng Việt
  const countWords = (s: string) => s.trim().split(/\s+/).length;

  const splitChunks = useCallback((text: string): Array<{ text: string; isClause: boolean; pauseMs: number }> => {
    const raw: Array<{ text: string; isClause: boolean; pauseMs: number }> = [];

    // Tách theo paragraph (\n) trước — pause dài nhất
    const paragraphs = text.split(/\n+/);

    for (let pi = 0; pi < paragraphs.length; pi++) {
      const para = paragraphs[pi].trim();
      if (!para) continue;

      // Tách câu theo .!?…
      const sentences = para.match(/[^.!?…]+(?:[.!?](?![.!?])|…|\.{3})+|[^.!?…]+$/g) ?? [para];

      for (let si = 0; si < sentences.length; si++) {
        const sent = sentences[si].trim();
        if (!sent) continue;

        const isLastSentenceInPara = si === sentences.length - 1;
        const isLastPara           = pi === paragraphs.length - 1;
        const hasEllipsis          = /\.{3}|…/.test(sent);
        const hasDash              = /[\u2014\u2013]/.test(sent);

        // Câu ngắn ≤ 15 từ → không tách thêm
        if (countWords(sent) <= 15) {
          let pauseMs = 400;
          if (isLastSentenceInPara && !isLastPara) pauseMs = 640;
          else if (hasEllipsis || hasDash) pauseMs = 288;
          raw.push({ text: sent, isClause: false, pauseMs });
          continue;
        }

        // Câu dài → tách theo dấu phụ: , ; : — …
        const parts: string[] = [];
        let buf = '';
        for (let ci = 0; ci < sent.length; ci++) {
          buf += sent[ci];
          const ch = sent[ci];
          const isBreak = /[,;:\u2014\u2013]/.test(ch);
          if (isBreak && countWords(buf) >= 4) { parts.push(buf.trim()); buf = ''; }
        }
        if (buf.trim()) parts.push(buf.trim());

        // Merge part < 4 từ với part sau
        for (let k = 0; k < parts.length; k++) {
          if (countWords(parts[k]) < 4 && k < parts.length - 1) {
            parts[k + 1] = parts[k] + ' ' + parts[k + 1];
            parts[k] = '';
          }
        }
        const validParts = parts.filter(p => p.trim());

        for (let k = 0; k < validParts.length; k++) {
          const p               = validParts[k];
          const isClause        = k < validParts.length - 1;
          const nextText        = k + 1 < validParts.length ? validParts[k + 1] : '';
          const isBeforeConnector = CONNECTORS.test(nextText.trimStart());
          const partHasDash     = /[\u2014\u2013]/.test(p);
          const partHasEllipsis = /\.{3}|…/.test(p);

          let pauseMs: number;
          if (!isClause) {
            if (isLastSentenceInPara && !isLastPara) pauseMs = 640;
            else if (partHasEllipsis || partHasDash) pauseMs = 288;
            else pauseMs = 400;
          } else {
            if (isBeforeConnector)               pauseMs = 320;
            else if (countWords(p) > 10)         pauseMs = 240;
            else if (partHasDash || partHasEllipsis) pauseMs = 288;
            else                                 pauseMs = 192;
          }
          raw.push({ text: p, isClause, pauseMs });
        }
      }
    }

    // Merge chunk < 3 từ với chunk kế
    const merged: Array<{ text: string; isClause: boolean; pauseMs: number }> = [];
    for (let i = 0; i < raw.length; i++) {
      const cur = raw[i];
      if (countWords(cur.text) < 3 && i < raw.length - 1) {
        raw[i + 1] = { text: cur.text + ' ' + raw[i + 1].text, isClause: raw[i + 1].isClause, pauseMs: raw[i + 1].pauseMs };
        continue;
      }
      merged.push(cur);
    }
    return merged.length > 0 ? merged : [{ text: text.trim(), isClause: false, pauseMs: 250 }];
  }, []);


  // ── prefetchNextChapter: generate ngầm chương tiếp theo — pipeline song song như streamChapter ──
  const prefetchNextChapter = useCallback(async (nextMeta: { id: string; index: number; title: string }) => {
    if (prefetchedChapRef.current?.id === nextMeta.id && prefetchDoneRef.current) {
      console.log(`[W:Prefetch] SKIP: already done id=${nextMeta.id}`);
      return;
    }

    // ── Resume case: goToChapter đã restore buffer partial + spawn workers mới ──
    // Nhận ra bằng: cùng id + chưa done + đã có chap + đã có chunks trong buffer
    const isResume = prefetchingIdRef.current === nextMeta.id
                  && !prefetchDoneRef.current
                  && prefetchedChapRef.current?.id === nextMeta.id
                  && prefetchedPCMRef.current.length > 0;

    let chap: Chapter;
    let resumeFromIndex = 0;

    if (isResume) {
      console.log(`[W:Prefetch] RESUME: id=${nextMeta.id} từ chunk ${prefetchedPCMRef.current.length}`);
      prefetchStopRef.current = false;
      chap = prefetchedChapRef.current!;
      resumeFromIndex = prefetchedPCMRef.current.length;
    } else {
      console.log(`[W:Prefetch] START: id=${nextMeta.id} title="${nextMeta.title}"`);

      // Set ngay lập tức để tránh gọi lại nhiều lần từ pollPlayed
      prefetchingIdRef.current = nextMeta.id;

      // Reset
      prefetchStopRef.current = true;
      await new Promise(r => setTimeout(r, 50));
      prefetchStopRef.current   = false;
      prefetchedPCMRef.current  = [];
      prefetchDoneRef.current   = false;
      prefetchedChapRef.current = null;

      // Fetch content
      console.log(`[W:Prefetch] Fetching content: /api/chapters/${nextMeta.id}`);
      const res  = await fetch(`/api/chapters/${nextMeta.id}`).then(r => r.json());
      chap = res.data ?? res;
      console.log(`[W:Prefetch] Content OK: id=${chap.id} title="${chap.title}" contentLen=${chap.content?.length ?? 0}`);
      if (prefetchStopRef.current) { console.log(`[W:Prefetch] STOPPED after fetch`); return; }
      prefetchedChapRef.current = chap;
    }

    const pool = workerPoolRef.current;
    if (!pool.length) { console.log(`[W:Prefetch] ABORT: worker pool empty`); return; }

    const voiceMeta = voices.find((v: any) => v.id === selectedVoice);
    const modelBase = `/models/custom/${voiceMeta?.path ?? selectedVoice}`;
    const workerBase = {
      modelUrl:              `${modelBase}.onnx`,
      modelConfigUrl:        `${modelBase}.onnx.json`,
      onnxruntimeUrl:        '/piper-wasm',
      piperPhonemizeJsUrl:   '/piper-wasm/piper_phonemize.js',
      piperPhonemizeWasmUrl: '/piper-wasm/piper_phonemize.wasm',
      piperPhonemizeDataUrl: '/piper-wasm/piper_phonemize.data',
      blobs: {},
    };

    const text   = stripHtml((chap.title ? `Chương ${chap.index}. ${cleanTitle(chap.title, chap.index)}. ` : '') + chap.content);
    const chunks = splitChunks(text);
    const total  = chunks.length;
    prefetchTotalRef.current = total; // biết tổng ngay sau splitChunks → playFromPrefetchBuffer dùng được

    // ── Song song như streamChapter ──
    // phonemeQueue + resolvers để stage1 notify stage2 ngay lập tức
    const phonemeQueue: Array<{ ids: number[]; isClause: boolean; pauseMs: number } | null> = new Array(total).fill(null);
    const phonemeResolvers: Array<((val: { ids: number[]; isClause: boolean; pauseMs: number }) => void) | null> = new Array(total).fill(null);

    const waitPhoneme = (i: number): Promise<{ ids: number[]; isClause: boolean; pauseMs: number }> => {
      if (phonemeQueue[i]) return Promise.resolve(phonemeQueue[i]!);
      return new Promise(resolve => { phonemeResolvers[i] = resolve; });
    };

    // Stage 1: phonemize — resume: bỏ qua chunks đã có, bắt đầu từ resumeFromIndex
    const phonemizeWorker = pool[0];
    const phonemizeAll = (async () => {
      for (let i = resumeFromIndex; i < total; i++) {
        if (prefetchStopRef.current) break;
        const jobId = `pre_ph_${i}_${Date.now()}`;
        await new Promise<void>((resolve, reject) => {
          const h = (e: MessageEvent) => {
            if (e.data.kind === 'phonemizeResult' && e.data.jobId === jobId) {
              phonemizeWorker.removeEventListener('message', h);
              const val = { ids: e.data.phonemeIds, isClause: chunks[i].isClause, pauseMs: chunks[i].pauseMs };
              phonemeQueue[i] = val;
              phonemeResolvers[i]?.(val);
              phonemeResolvers[i] = null;
              resolve();
            }
            if (e.data.kind === 'phonemizeError' && e.data.jobId === jobId) {
              phonemizeWorker.removeEventListener('message', h);
              reject(e.data.error);
            }
          };
          phonemizeWorker.addEventListener('message', h);
          phonemizeWorker.postMessage({ kind: 'phonemize_only', jobId, input: chunks[i].text, ...workerBase });
        }).catch(() => {});
      }
    })();

    // Stage 2: N infer workers chạy song song — lưu PCM theo thứ tự
    // Resume: pcmBuffer giữ lại phần đã có, nextTask bắt đầu từ resumeFromIndex
    const pcmBuffer: Array<{ pcm: Float32Array; sampleRate: number; isClause: boolean; pauseMs: number } | null> = new Array(total).fill(null);
    // Restore phần đã có vào pcmBuffer (resume case)
    for (let i = 0; i < resumeFromIndex; i++) {
      if (prefetchedPCMRef.current[i]) pcmBuffer[i] = prefetchedPCMRef.current[i];
    }
    let nextTask = resumeFromIndex; // resume: bỏ qua chunks đã có

    const consumers = pool.map((worker: Worker, wIdx: number) => {
      if (pool.length > 1 && wIdx === 0) return Promise.resolve(); // worker[0] dành phonemize
      return (async () => {
        while (true) {
          if (prefetchStopRef.current) break;
          if (nextTask >= total) break;
          const i = nextTask++;
          const { ids: phonemeIds, isClause, pauseMs } = await waitPhoneme(i);
          if (prefetchStopRef.current) break;
          const jobId = `pre_inf_${i}_${Date.now()}`;
          try {
            const pcmResult = await new Promise<{ pcm: Float32Array; sampleRate: number }>((resolve, reject) => {
              const h = (e: MessageEvent) => {
                if (e.data.kind === 'inferResult' && e.data.jobId === jobId) {
                  worker.removeEventListener('message', h);
                  resolve({ pcm: e.data.pcm, sampleRate: e.data.sampleRate });
                }
                if (e.data.kind === 'inferError' && e.data.jobId === jobId) {
                  worker.removeEventListener('message', h);
                  reject(e.data.error);
                }
              };
              worker.addEventListener('message', h);
              worker.postMessage({ kind: 'infer', jobId, phonemeIds, ...workerBase });
            });
            if (!prefetchStopRef.current) {
              pcmBuffer[i] = { ...pcmResult, isClause, pauseMs };
              // Push ngay vào prefetchedPCMRef để pollNewChunks schedule được
              prefetchedPCMRef.current[i] = { ...pcmResult, isClause, pauseMs };
              console.log(`[Prefetch:W${wIdx}] chunk ${i}/${total-1} done`);
            }
          } catch { continue; }
        }
      })();
    });

    await Promise.allSettled([phonemizeAll, ...consumers]);

    if (!prefetchStopRef.current) {
      prefetchedPCMRef.current = pcmBuffer.filter(Boolean) as typeof prefetchedPCMRef.current;
      prefetchDoneRef.current  = true;
      console.log(`[W:Prefetch] Done: ${chap.title} id=${chap.id} — ${prefetchedPCMRef.current.length} chunks`);
    }
  }, [voices, selectedVoice, splitChunks]);

  const streamChapter = useCallback(async (chapter: Chapter) => {
    console.log(`[W:Stream] streamChapter called: ${chapter.title} selectedVoice=${selectedVoice}`);
    if (!selectedVoice) { console.log('[W:Stream] ABORT: no selectedVoice'); return; }

    stopFlagRef.current  = false;
    pipelineDone.current = false;
    endTimesRef.current  = [];
    generatedRef.current = 0;
    audioHandledGlobalRef.current = false;
    activeChapIndexRef.current = chapter.index;

    setIsGenerating(true);
    setIsPlaying(false);
    setSentencePlayed(0);
    setSentenceGenerated(0);

    const actx = getActx();

    // Worker pool — raw Worker (không qua Piper class)
    const workerCount = detectWorkerCount();
    workerCountRef.current = workerCount;
    const makeWorker = () => new Worker(`/workers/tts-worker.js?v=pcm1`, { type: 'module' });
    while (workerPoolRef.current.length < workerCount) workerPoolRef.current.push(makeWorker());
    while (workerPoolRef.current.length > workerCount) {
      try { workerPoolRef.current.pop()?.terminate(); } catch {}
    }
    console.log(`[TTS] Worker pool: ${workerPoolRef.current.length} workers — phonemize=worker[0], infer=worker[1..${workerPoolRef.current.length - 1}]`);
    console.log(`[TTS] Chapter: ${chapter.title} — chunks will be split from text`);

    const voiceMeta = voices.find(v => v.id === selectedVoice);
    const modelBase = `/models/custom/${voiceMeta?.path ?? selectedVoice}`;
    const workerBase = {
      modelUrl:              `${modelBase}.onnx`,
      modelConfigUrl:        `${modelBase}.onnx.json`,
      onnxruntimeUrl:        '/piper-wasm',
      piperPhonemizeJsUrl:   '/piper-wasm/piper_phonemize.js',
      piperPhonemizeWasmUrl: '/piper-wasm/piper_phonemize.wasm',
      piperPhonemizeDataUrl: '/piper-wasm/piper_phonemize.data',
      blobs: {},
    };

    const text   = stripHtml((chapter.title ? chapter.title + '. ' : '') + chapter.content);
    const chunks = splitChunks(text);
    setSentenceTotal(chunks.length);

    const chapIndex = chapter.index;

    // phonemeQueue[i]: null = chưa xong, object = đã có phonemeIds
    const phonemeQueue: Array<{ ids: number[]; isClause: boolean; pauseMs: number } | null> = new Array(chunks.length).fill(null);
    // phonemeResolvers[i]: resolve callback — notify consumer ngay khi phonemize xong
    const phonemeResolvers: Array<((val: { ids: number[]; isClause: boolean; pauseMs: number }) => void) | null> = new Array(chunks.length).fill(null);

    // Stage 1: phonemize toàn bộ chunks trên worker[0] tuần tự (nhanh, ~vài ms/chunk)
    // Chạy song song với stage 2 bên dưới
    const phonemizeWorker = workerPoolRef.current[0];
    const phonemizeAll = (async () => {
      for (let i = 0; i < chunks.length; i++) {
        if (stopFlagRef.current) break;
        const jobId = `ph_${i}`;
        await new Promise<void>((resolve, reject) => {
          const h = (e: MessageEvent) => {
            if (e.data.kind === 'phonemizeResult' && e.data.jobId === jobId) {
              phonemizeWorker.removeEventListener('message', h);
              const val = { ids: e.data.phonemeIds, isClause: chunks[i].isClause, pauseMs: chunks[i].pauseMs };
              phonemeQueue[i] = val;
              // Notify consumer ngay lập tức — không cần polling
              phonemeResolvers[i]?.(val);
              phonemeResolvers[i] = null;
              resolve();
            }
            if (e.data.kind === 'phonemizeError' && e.data.jobId === jobId) {
              phonemizeWorker.removeEventListener('message', h);
              reject(e.data.error);
            }
          };
          phonemizeWorker.addEventListener('message', h);
          phonemizeWorker.postMessage({ kind: 'phonemize_only', jobId, input: chunks[i].text, ...workerBase });
        });
      }
    })();

    

    const pollPlayed = () => {
      if (stopFlagRef.current) { console.log('[W:Poll] stopped by stopFlag'); return; }
      if (audioHandledGlobalRef.current) return; // silent — đã xử lý rồi
      if (activeChapIndexRef.current !== chapIndex) { console.log(`[W:Poll] stale — chapIndex=${chapIndex} active=${activeChapIndexRef.current} — dừng`); return; }
      const actxNow = actxRef.current;
      if (!actxNow) { console.log('[W:Poll] no actx — actxRef null'); return; }
      const now = actxNow.currentTime;

      const played = endTimesRef.current.filter(t => t <= now).length;
      setSentencePlayed(played);

      // Prefetch được trigger trong finally sau khi restart workers

      // Đo RAM: ưu tiên measureUserAgentSpecificMemory (cần crossOriginIsolated)
      // Fallback: performance.memory (JS heap only, không tính worker)
      // Estimate thực tế: JS heap + workers (~62MB/worker × N) + phonemize WASM (~10MB)
      const nWorkers = workerPoolRef.current.length;
      const estimateWorkerMB = nWorkers * 62 + 10; // model + phonemize WASM
      if ((performance as any).measureUserAgentSpecificMemory) {
        (performance as any).measureUserAgentSpecificMemory()
          .then((result: any) => {
            setRamMB(Math.round(result.bytes / 1024 / 1024));
          })
          .catch(() => {
            const mem = (performance as any).memory;
            const jsMB = mem ? Math.round(mem.totalJSHeapSize / 1024 / 1024) : 0;
            setRamMB(jsMB + estimateWorkerMB);
          });
      } else {
        const mem = (performance as any).memory;
        const jsMB = mem ? Math.round(mem.totalJSHeapSize / 1024 / 1024) : 0;
        // Cộng estimate worker memory vì performance.memory không tính worker
        setRamMB(jsMB + estimateWorkerMB);
      }

      // audioEmpty: tất cả scheduled audio đã phát xong
      // Dùng endTimesRef.current cuối cùng thay vì nextStartRef
      // vì nextStartRef = thời điểm tương lai, không biết khi nào "hết"
      const lastEndTime = endTimesRef.current[endTimesRef.current.length - 1] ?? 0;
      const audioEmpty  = pipelineDone.current && lastEndTime > 0 && now >= lastEndTime - 0.3;
      if (audioEmpty) {
        if (audioHandledGlobalRef.current) return; // đã bị cái khác xử lý rồi
        audioHandledGlobalRef.current = true; // claim ngay — atomic trong JS single-thread
        setSentencePlayed(generatedRef.current);
        setIsPlaying(false);
        setCompletedChapters(prev => new Set(prev).add(chapIndex));

        // Auto next — dùng prefetch buffer nếu có, không fetch lại
        const sorted2  = [...allChapters].sort((a, b) => a.index - b.index);
        const nextMeta = sorted2.find(c => c.index > chapIndex);
        console.log(`[W:AutoNext] nextMeta=${nextMeta?.id ?? 'null'} prefetchId=${prefetchingIdRef.current} prefetchDone=${prefetchDoneRef.current} prefetchChap=${prefetchedChapRef.current?.id ?? 'null'}`);
        if (!nextMeta) { console.log('[W:AutoNext] Không có chương tiếp — dừng'); return; }

        // Có prefetch (đủ hoặc đang chạy) → play ngay, pollNewChunks sẽ schedule tiếp
        const hasPrefetch = prefetchedChapRef.current?.id === nextMeta.id &&
                            (prefetchDoneRef.current || prefetchingIdRef.current === nextMeta.id);
        console.log(`[W:AutoNext] hasPrefetch=${hasPrefetch} prefetchDone=${prefetchDoneRef.current}`);
        if (hasPrefetch) {
          const nextChap = prefetchedChapRef.current!;
          console.log(`[W:AutoNext] Play ngay từ buffer (partial ok): ${nextChap.title} chunks=${prefetchedPCMRef.current.length}`);
          setLoadedChapters(prev => ({ ...prev, [nextMeta.index]: nextChap }));
          setCurrentChapter(nextChap);
          router.replace(`/truyen/${slug}/nghe?chuong=${nextMeta.index}`, { scroll: false });
          playFromPrefetchBuffer(nextChap);
        } else {
          console.log(`[W:AutoNext] Buffer không có — fetch chapter ${nextMeta.id}...`);
          fetch(`/api/chapters/${nextMeta.id}`)
            .then(r => r.json())
            .then((res: any) => {
              const nextChap: Chapter = res.data ?? res;
              console.log(`[W:AutoNext] Fetch xong: ${nextChap.title} — gọi streamChapter`);
              setLoadedChapters(prev => ({ ...prev, [nextMeta.index]: nextChap }));
              setCurrentChapter(nextChap);
              router.replace(`/truyen/${slug}/nghe?chuong=${nextMeta.index}`, { scroll: false });
              streamChapterRef.current?.(nextChap);
            });
        }
        return;
      }

      setTimeout(pollPlayed, 100);
    };

    try {
      // ── Task Queue + PCM pipeline ──
      // Stage 1: worker[0] phonemize tất cả chunks → phonemeQueue (nhanh, song song)
      // Stage 2: N workers lấy phonemeIds → ONNX infer → raw PCM → schedulePCM
      // Thứ tự audio: slotPromise chain

      const pool  = workerPoolRef.current;
      const total = chunks.length;

      const slotReady:   Array<() => void>    = new Array(total);
      const slotPromise: Array<Promise<void>> = Array.from({ length: total }, (_, i) =>
        new Promise<void>(res => { slotReady[i] = res; })
      );

      let nextTask = 0;

      // Chờ phonemeQueue[i] sẵn sàng — Promise, không polling
      const waitPhoneme = (i: number): Promise<{ ids: number[]; isClause: boolean; pauseMs: number }> => {
        if (phonemeQueue[i]) return Promise.resolve(phonemeQueue[i]!);
        return new Promise(resolve => { phonemeResolvers[i] = resolve; });
      };

      // Consumer: worker[wIdx] lấy tasks, infer, schedule PCM
      // Worker[0] đang làm phonemize → nếu có > 1 worker thì worker[0] chỉ phonemize
      const consumers = pool.map((worker: Worker, wIdx: number) => {
        if (pool.length > 1 && wIdx === 0) return Promise.resolve(); // worker[0] dành cho phonemize
        return (async () => {
          while (true) {
            if (stopFlagRef.current) break;
            if (nextTask >= total) break;
            const i = nextTask++;

            const { ids: phonemeIds, isClause, pauseMs } = await waitPhoneme(i);
            if (stopFlagRef.current) { slotReady[i](); break; }

            // Gửi infer job — nhận raw PCM qua Transferable
            const jobId = `inf_${i}_${Date.now()}`;
            let pcmResult: { pcm: Float32Array; sampleRate: number };
            try {
              pcmResult = await new Promise((resolve, reject) => {
                const h = (e: MessageEvent) => {
                  if (e.data.kind === 'inferResult' && e.data.jobId === jobId) {
                    worker.removeEventListener('message', h);
                    resolve({ pcm: e.data.pcm, sampleRate: e.data.sampleRate });
                  }
                  if (e.data.kind === 'inferError' && e.data.jobId === jobId) {
                    worker.removeEventListener('message', h);
                    reject(e.data.error);
                  }
                };
                worker.addEventListener('message', h);
                worker.postMessage({ kind: 'infer', jobId, phonemeIds, ...workerBase });
              });
            } catch (e) {
              console.warn(`[TTS] infer chunk ${i} error:`, e);
              slotReady[i]();
              continue;
            }
            if (stopFlagRef.current) { slotReady[i](); break; }

            // Chờ chunk trước schedule xong (đảm bảo thứ tự audio)
            if (i > 0) await slotPromise[i - 1];
            if (stopFlagRef.current) { slotReady[i](); break; }

            // Schedule PCM trực tiếp — zero-copy, không WAV, không Blob
            const endTime = schedulePCM(actx, pcmResult.pcm, pcmResult.sampleRate, isClause, pauseMs);
            endTimesRef.current.push(endTime);
            generatedRef.current++;
            setSentenceGenerated(generatedRef.current);
            console.log(`[Worker:${wIdx}] chunk ${i}/${total-1} infer done — generated=${generatedRef.current}`);
            slotReady[i]();

            if (generatedRef.current === BUFFER_AHEAD) {
              setIsGenerating(false);
              setIsPlaying(true);
              pollPlayed();
            }
          }
        })();
      });

      await Promise.allSettled([phonemizeAll, ...consumers]);

    } catch (err) {
      console.error('[TTS] error:', err);
    } finally {
      pipelineDone.current = true;
      setIsGenerating(false);
      if (generatedRef.current > 0 && generatedRef.current < BUFFER_AHEAD) {
        setIsPlaying(true);
        pollPlayed();
      }
      stopFlagRef.current = false;

      // Trigger prefetch nếu chưa được trigger từ BUFFER_AHEAD
      const sortedP   = [...allChapters].sort((a, b) => a.index - b.index);
      const nextMetaP = sortedP.find(c => c.index > chapIndex);
      console.log(`[W:Finally] pipelineDone — chapIndex=${chapIndex} nextMeta=${nextMetaP?.id ?? 'null'} prefetchingId=${prefetchingIdRef.current} prefetchDone=${prefetchDoneRef.current}`);
      if (nextMetaP && prefetchingIdRef.current !== nextMetaP.id && !prefetchDoneRef.current) {
        console.log(`[W:Finally] Trigger prefetch (chưa có từ BUFFER_AHEAD): ${nextMetaP.id}`);
        prefetchingIdRef.current = nextMetaP.id;
        prefetchNextChapter(nextMetaP);
      } else {
        console.log(`[W:Finally] Prefetch đã chạy rồi — skip`);
      }

      // Kick pollPlayed
      setTimeout(pollPlayed, 100);
    }
  }, [selectedVoice, voices, getActx, schedulePCM, scheduleChunk, splitChunks, allChapters, slug, router, detectWorkerCount, prefetchNextChapter]);

  // ── playFromPrefetchBuffer: play ngay chunks đã có, poll schedule chunks mới từ prefetch ──
  const playFromPrefetchBuffer = useCallback((chapter: Chapter) => {
    const chapIdx  = chapter.index;
    const isDone   = prefetchDoneRef.current;
    // Snapshot total NGAY LẬP TỨC — trước khi pollFromBuffer trigger prefetch chương tiếp
    // và prefetchNextChapter ghi đè prefetchTotalRef bằng total của chương sau
    const snapshotTotal = prefetchTotalRef.current;
    prefetchTotalRef.current = 0; // reset để chương tiếp không đọc nhầm
    // KHÔNG snapshot buffer — đọc trực tiếp prefetchedPCMRef để thấy chunks mới
    console.log(`[W:PlayBuffer] START: "${chapter.title}" chunks có sẵn=${prefetchedPCMRef.current.length} prefetchDone=${isDone}`);

    stopFlagRef.current  = false;
    pipelineDone.current = false;
    endTimesRef.current  = [];
    generatedRef.current = 0;
    audioHandledGlobalRef.current = false;
    activeChapIndexRef.current = chapter.index;
    setIsGenerating(!isDone);
    setIsPlaying(true);
    setSentencePlayed(0);
    setSentenceGenerated(0);
    // Dùng prefetchTotalRef nếu có (biết ngay sau splitChunks trong prefetchNextChapter)
    // fallback về số chunks đang có nếu chưa có total
    const knownTotal = snapshotTotal > 0 ? snapshotTotal : prefetchedPCMRef.current.length;
    if (knownTotal > 0) setSentenceTotal(knownTotal);

    const actx = getActx();

    // Schedule chunks đã có ngay lập tức
    let scheduledCount = 0;
    const scheduleAvailable = () => {
      const allChunks = prefetchedPCMRef.current;
      while (scheduledCount < allChunks.length) {
        if (stopFlagRef.current) break;
        const item    = allChunks[scheduledCount];
        const endTime = schedulePCM(actx, item.pcm, item.sampleRate, item.isClause, item.pauseMs);
        endTimesRef.current.push(endTime);
        generatedRef.current++;
        scheduledCount++;
      }
      setSentenceGenerated(generatedRef.current);
    };
    scheduleAvailable();
    console.log(`[W:PlayBuffer] Scheduled ${scheduledCount} chunks ngay`);

    if (isDone) {
      // Prefetch đã xong hoàn toàn — clear buffer, set pipelineDone
      prefetchedPCMRef.current  = [];
      prefetchDoneRef.current   = false;
      prefetchedChapRef.current = null;
      prefetchingIdRef.current  = null;
      pipelineDone.current      = true;
      setIsGenerating(false);
      setSentenceTotal(generatedRef.current);
      console.log(`[W:PlayBuffer] prefetchDone=true — pipelineDone=true total=${generatedRef.current}`);
    } else {
      // Prefetch chưa xong — poll để schedule chunks mới khi prefetch generate thêm
      console.log(`[W:PlayBuffer] prefetchDone=false — poll schedule chunks mới`);

      const pollNewChunks = () => {
        if (stopFlagRef.current) { console.log('[W:PlayBuffer] pollNewChunks stopped'); return; }

        // Schedule các chunks mới theo thứ tự liên tục — bỏ qua nếu chunk chưa có
        const allChunks = prefetchedPCMRef.current;
        while (scheduledCount < allChunks.length && allChunks[scheduledCount] != null) {
          const item    = allChunks[scheduledCount];
          const endTime = schedulePCM(actx, item.pcm, item.sampleRate, item.isClause, item.pauseMs);
          endTimesRef.current.push(endTime);
          generatedRef.current++;
          scheduledCount++;
        }
        setSentenceGenerated(generatedRef.current);
        console.log(`[W:PlayBuffer] pollNewChunks — scheduled=${scheduledCount} prefetchDone=${prefetchDoneRef.current}`);

        if (prefetchDoneRef.current) {
          // Prefetch xong — clear buffer, set pipelineDone
          prefetchedPCMRef.current  = [];
          prefetchDoneRef.current   = false;
          prefetchedChapRef.current = null;
          prefetchingIdRef.current  = null;
          pipelineDone.current      = true;
          setIsGenerating(false);
          setSentenceTotal(generatedRef.current);
          console.log(`[W:PlayBuffer] Prefetch Done — tổng ${generatedRef.current} chunks, pipelineDone=true`);
          return;
        }

        setTimeout(pollNewChunks, 100);
      };
      setTimeout(pollNewChunks, 100);
    }

    // Poll theo dõi audio + chuyển chương
    const pollFromBuffer = () => {
      if (stopFlagRef.current) return;
      if (audioHandledGlobalRef.current) return;
      if (activeChapIndexRef.current !== chapIdx) { console.log(`[W:PlayBuffer] stale — chapIdx=${chapIdx} active=${activeChapIndexRef.current} — dừng`); return; }
      const actxNow = actxRef.current;
      if (!actxNow) return;
      const now    = actxNow.currentTime;
      const played = endTimesRef.current.filter(t => t <= now).length;
      setSentencePlayed(played);

      // Trigger prefetch chương tiếp khi pipelineDone
      if (pipelineDone.current && prefetchingIdRef.current === null && !prefetchDoneRef.current) {
        const sortedB  = [...allChapters].sort((a, b) => a.index - b.index);
        const nextMeta = sortedB.find(c => c.index > chapIdx);
        if (nextMeta) {
          console.log(`[W:Prefetch] Trigger từ pollFromBuffer: id=${nextMeta.id}`);
          prefetchNextChapterRef.current?.(nextMeta);
        }
      }

      const lastEndTime = endTimesRef.current[endTimesRef.current.length - 1] ?? 0;
      const audioEmpty  = pipelineDone.current && lastEndTime > 0 && now >= lastEndTime - 0.3;
      if (audioEmpty) {
        if (audioHandledGlobalRef.current) return; // đã bị pollPlayed xử lý rồi
        audioHandledGlobalRef.current = true; // claim ngay
        setSentencePlayed(generatedRef.current);
        setIsPlaying(false);
        setCompletedChapters(prev => new Set(prev).add(chapIdx));

        const sortedB  = [...allChapters].sort((a, b) => a.index - b.index);
        const nextMeta = sortedB.find(c => c.index > chapIdx);
        console.log(`[W:AutoNext] audioEmpty (buffer) — nextMeta=${nextMeta?.id ?? 'null'} prefetchDone=${prefetchDoneRef.current}`);
        if (!nextMeta) return;

        // Có prefetch (done hay chưa done) → play ngay
        const hasPrefetch = prefetchedChapRef.current?.id === nextMeta.id &&
                            (prefetchDoneRef.current || prefetchingIdRef.current === nextMeta.id);
        console.log(`[W:AutoNext] hasPrefetch=${hasPrefetch} prefetchDone=${prefetchDoneRef.current}`);
        if (hasPrefetch) {
          const nextChap = prefetchedChapRef.current!;
          console.log(`[W:AutoNext] Play ngay từ buffer: ${nextChap.title} chunks=${prefetchedPCMRef.current.length}`);
          setLoadedChapters(prev => ({ ...prev, [nextMeta.index]: nextChap }));
          setCurrentChapter(nextChap);
          router.replace(`/truyen/${slug}/nghe?chuong=${nextMeta.index}`, { scroll: false });
          playFromPrefetchBufferRef.current?.(nextChap);
        } else {
          console.log(`[W:AutoNext] Fetch + stream: ${nextMeta.id}`);
          fetch(`/api/chapters/${nextMeta.id}`)
            .then(r => r.json())
            .then((res: any) => {
              const nextChap: Chapter = res.data ?? res;
              setLoadedChapters(prev => ({ ...prev, [nextMeta.index]: nextChap }));
              setCurrentChapter(nextChap);
              router.replace(`/truyen/${slug}/nghe?chuong=${nextMeta.index}`, { scroll: false });
              streamChapterRef.current?.(nextChap);
            });
        }
        return;
      }
      setTimeout(pollFromBuffer, 100);
    };
    setTimeout(pollFromBuffer, 100);
  }, [getActx, schedulePCM, allChapters, slug, router]);

  // ── Sync refs để tránh circular dependency ──
  useEffect(() => {
    streamChapterRef.current          = streamChapter;
    playFromPrefetchBufferRef.current = playFromPrefetchBuffer;
    prefetchNextChapterRef.current    = prefetchNextChapter;
  }, [streamChapter, playFromPrefetchBuffer, prefetchNextChapter]);

  // ── Play / Pause / Toggle ──
  const handlePlay = useCallback(async () => {
    if (isPlaying) return;
    if (actxRef.current?.state === 'suspended') {
      await actxRef.current.resume();
      setIsPlaying(true);
      return;
    }
    await streamChapter(currentChapter);
  }, [isPlaying, currentChapter, streamChapter]);

  const handlePause = useCallback(async () => {
    if (actxRef.current?.state === 'running') await actxRef.current.suspend();
    setIsPlaying(false);
  }, []);

  const togglePlay = () => isPlaying ? handlePause() : handlePlay();
  const skip       = (_secs: number) => {}; // seek không support với sentence streaming

  // ── goToChapter: chuyển chương + phát luôn ──
  const goToChapter = useCallback(async (meta: ChapterMeta) => {
    if (meta.index === currentIdx) return;

    console.log(`[W:GoTo] chương ${meta.index} id=${meta.id} — prefetchingId=${prefetchingIdRef.current} prefetchChap=${prefetchedChapRef.current?.id ?? 'null'} prefetchDone=${prefetchDoneRef.current}`);

    // ── Snapshot prefetch state TRƯỚC stopAll ──
    // stopAll() sẽ terminate workers + xóa sạch tất cả prefetch refs
    // nên phải snapshot trước để còn dùng được sau
    const isPrefetching  = prefetchingIdRef.current === meta.id && !prefetchDoneRef.current;
    const isPrefetchDone = prefetchedChapRef.current?.id === meta.id && prefetchDoneRef.current;
    const hasPrefetch    = isPrefetchDone || isPrefetching;

    const snapshotChap   = hasPrefetch ? prefetchedChapRef.current : null;
    const snapshotPCM    = hasPrefetch ? [...prefetchedPCMRef.current] : [];
    const snapshotDone   = isPrefetchDone;

    // Stop audio hiện tại + terminate workers + xóa refs
    stopAll();

    setSentencePlayed(0);
    setSentenceGenerated(0);
    setSentenceTotal(snapshotPCM.length > 0 ? snapshotPCM.length : 0);

    if (hasPrefetch && snapshotChap) {
      console.log(`[W:GoTo] Dùng prefetch — done=${snapshotDone} chunks=${snapshotPCM.length}`);

      // Restore PCM buffer và metadata
      prefetchedChapRef.current = snapshotChap;
      prefetchedPCMRef.current  = snapshotPCM;
      prefetchDoneRef.current   = snapshotDone;
      prefetchStopRef.current   = false;

      if (!snapshotDone) {
        // Partial: cần spawn lại workers để generate tiếp phần còn thiếu
        // prefetchNextChapter sẽ detect prefetchedChapRef.id === meta.id
        // nhưng prefetchDone=false → nó sẽ reset và generate lại từ đầu
        // nên set prefetchingIdRef TRƯỚC để nó skip reset, generate tiếp từ chunk đã có
        prefetchingIdRef.current = meta.id;

        // Spawn workers mới (workers cũ đã bị terminate bởi stopAll)
        const wCount = detectWorkerCount();
        const makeWorker = () => new Worker(`/workers/tts-worker.js?v=pcm1`, { type: 'module' });
        while (workerPoolRef.current.length < wCount) workerPoolRef.current.push(makeWorker());
        console.log(`[W:GoTo] Spawned ${workerPoolRef.current.length} workers mới để resume prefetch`);

        // Resume generate từ chunk tiếp theo sau phần đã có
        // prefetchNextChapterRef sẽ generate và push vào prefetchedPCMRef từ index snapshotPCM.length
        const resumeMeta = { id: snapshotChap.id, index: snapshotChap.index, title: snapshotChap.title };
        prefetchNextChapterRef.current?.(resumeMeta);
      } else {
        // Done: spawn workers sẵn sàng để prefetch chương tiếp theo (ch+2)
        prefetchingIdRef.current = null;
        const wCount = detectWorkerCount();
        const makeWorker = () => new Worker(`/workers/tts-worker.js?v=pcm1`, { type: 'module' });
        while (workerPoolRef.current.length < wCount) workerPoolRef.current.push(makeWorker());
        console.log(`[W:GoTo] Spawned ${workerPoolRef.current.length} workers mới cho prefetch ch+2`);
      }

      setLoadedChapters(prev => ({ ...prev, [meta.index]: snapshotChap }));
      setCurrentChapter(snapshotChap);
      router.replace(`/truyen/${slug}/nghe?chuong=${meta.index}`, { scroll: false });
      playFromPrefetchBufferRef.current?.(snapshotChap);
    } else {
      // Không có prefetch gì — fetch + stream bình thường
      console.log(`[W:GoTo] Không có prefetch — fetch + stream`);

      let chap = loadedChapters[meta.index];
      if (!chap) {
        const res  = await fetch(`/api/chapters/${meta.id}`);
        const json = await res.json();
        chap       = json.data ?? json;
        setLoadedChapters(prev => ({ ...prev, [meta.index]: chap }));
      }
      setCurrentChapter(chap);
      router.replace(`/truyen/${slug}/nghe?chuong=${meta.index}`, { scroll: false });
      streamChapterRef.current?.(chap);
    }
  }, [currentIdx, loadedChapters, slug, router, stopAll, detectWorkerCount]);

  const goChapter = useCallback(async (dir: 'prev' | 'next') => {
    const curPos = sortedChapters.findIndex(c => c.index === currentIdx);
    const target = dir === 'prev' ? sortedChapters[curPos - 1] : sortedChapters[curPos + 1];
    if (target) await goToChapter(target);
  }, [sortedChapters, currentIdx, goToChapter]);

  const decreaseSpeed = () => setSpeed(s => Math.max(MIN_SPEED, Math.round((s - SPEED_STEP) * 100) / 100));
  const increaseSpeed = () => setSpeed(s => Math.min(MAX_SPEED, Math.round((s + SPEED_STEP) * 100) / 100));
  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);

  // ─────────────────────────────────────────────────────────
  // ── Shared UI ──
  // ─────────────────────────────────────────────────────────

  // Debug panel — 4 ô ngang, luôn flex row
  const DebugPanel = (
    <div>
      {/* Progress bar 2 layer */}
      <div className="w-full h-2 bg-[#231f1a] rounded-full relative overflow-hidden">
        <div className="absolute inset-y-0 left-0 bg-green-500/40 rounded-full transition-all duration-500"
          style={{ width: sentenceTotal > 0 ? `${(sentenceGenerated / sentenceTotal) * 100}%` : '0%' }} />
        <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#e8580a] to-[#ff7c35] rounded-full transition-all duration-500"
          style={{ width: sentenceTotal > 0 ? `${(sentencePlayed / sentenceTotal) * 100}%` : '0%' }} />
      </div>
      {/* 4 ô */}
      <div className="mt-2 flex gap-1.5">
        <div className="flex-1 flex flex-col items-center py-2 px-1 rounded-lg bg-[#e8580a]/10 border border-[#e8580a]/20 min-w-0">
          <span className="text-[20px] font-black text-[#ff7c35] leading-none">{sentencePlayed}</span>
          <span className="text-[8px] font-bold uppercase tracking-widest text-[#8a7e72] mt-1 whitespace-nowrap">▶ Phát</span>
        </div>
        <div className="flex-1 flex flex-col items-center py-2 px-1 rounded-lg bg-green-900/20 border border-green-700/20 min-w-0">
          <span className="text-[20px] font-black text-green-400 leading-none">{sentenceGenerated}</span>
          <span className="text-[8px] font-bold uppercase tracking-widest text-[#8a7e72] mt-1 whitespace-nowrap">✓ Tạo</span>
        </div>
        <div className="flex-1 flex flex-col items-center py-2 px-1 rounded-lg bg-white/[0.04] border border-white/[0.06] min-w-0">
          <span className="text-[20px] font-black text-[#f0ebe4] leading-none">{sentenceTotal}</span>
          <span className="text-[8px] font-bold uppercase tracking-widest text-[#8a7e72] mt-1 whitespace-nowrap">∑ Tổng</span>
        </div>
        <div className="flex-1 flex flex-col items-center py-2 px-1 rounded-lg bg-blue-900/20 border border-blue-700/20 min-w-0">
          <span className="text-[20px] font-black text-blue-400 leading-none">{ramMB ?? '—'}</span>
          <span className="text-[8px] font-bold uppercase tracking-widest text-[#8a7e72] mt-1 whitespace-nowrap">MB RAM</span>
        </div>
      </div>
    </div>
  );

  // Controls
  const Controls = (
    <div className="flex items-center justify-center gap-3">
      <button onClick={() => goChapter('prev')} disabled={!hasPrev}
        className="w-9 h-9 rounded-full bg-[#231f1a] border border-white/[0.07] flex items-center justify-center text-[#8a7e72] disabled:opacity-30 hover:text-white transition-colors">
        <SkipBack size={16} />
      </button>
      <button onClick={() => skip(-15)}
        className="w-9 h-9 rounded-full bg-[#231f1a] border border-white/[0.07] flex items-center justify-center text-[#8a7e72] hover:text-white transition-colors">
        <RotateCcw size={15} />
      </button>
      <button onClick={togglePlay} disabled={isGenerating && generatedRef.current === 0}
        className="w-14 h-14 rounded-full bg-gradient-to-br from-[#e8580a] to-[#ff7c35] flex items-center justify-center text-white shadow-[0_4px_20px_rgba(232,88,10,0.5)] hover:shadow-[0_6px_28px_rgba(232,88,10,0.65)] transition-all active:scale-95 disabled:opacity-60">
        {isPlaying
          ? <Pause size={22} fill="white" />
          : <Play  size={22} fill="white" className="translate-x-0.5" />}
      </button>
      <button onClick={() => skip(15)}
        className="w-9 h-9 rounded-full bg-[#231f1a] border border-white/[0.07] flex items-center justify-center text-[#8a7e72] hover:text-white transition-colors">
        <RotateCw size={15} />
      </button>
      <button onClick={() => goChapter('next')} disabled={!hasNext}
        className="w-9 h-9 rounded-full bg-[#231f1a] border border-white/[0.07] flex items-center justify-center text-[#8a7e72] disabled:opacity-30 hover:text-white transition-colors">
        <SkipForward size={16} />
      </button>
    </div>
  );

  // Voice + Speed
  const VoiceSpeed = (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <button onClick={() => setShowVoiceMenu(v => !v)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-[#231f1a] border border-white/[0.07] hover:border-[#e8580a]/30 transition-colors">
          <span className="text-sm">🎙</span>
          <span className="text-[11px] font-bold text-[#f0ebe4] flex-1 text-left truncate">
            {voices.find(v => v.id === selectedVoice)?.name ?? 'Chọn giọng'}
          </span>
          <ChevronDown size={12} className="text-[#8a7e72]" />
        </button>
        {showVoiceMenu && voices.length > 0 && (
          <div className="absolute bottom-full left-0 right-0 mb-1 bg-[#1a1612] border border-white/[0.09] rounded-xl overflow-hidden shadow-xl z-20 max-h-48 overflow-y-auto">
            {voices.map(v => (
              <button key={v.id} onClick={() => { setSelectedVoice(v.id); setShowVoiceMenu(false); }}
                className={`w-full text-left px-3 py-2.5 text-[11px] font-medium transition-colors ${
                  v.id === selectedVoice ? 'bg-[#e8580a]/15 text-[#ff7c35]' : 'text-[#f0ebe4] hover:bg-white/[0.05]'
                }`}>
                {v.name}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 rounded-xl bg-[#231f1a] border border-[#e8580a]/35 overflow-hidden">
        <button onClick={decreaseSpeed} disabled={speed <= MIN_SPEED}
          className="px-2.5 py-2 text-[#e8580a] text-[13px] font-black hover:bg-[#e8580a]/15 transition-colors disabled:opacity-30">−</button>
        <span className="text-[#e8580a] text-[11px] font-black min-w-[32px] text-center">{speed.toFixed(2)}x</span>
        <button onClick={increaseSpeed} disabled={speed >= MAX_SPEED}
          className="px-2.5 py-2 text-[#e8580a] text-[13px] font-black hover:bg-[#e8580a]/15 transition-colors disabled:opacity-30">+</button>
      </div>
      <div className="flex items-center gap-1 rounded-xl bg-[#231f1a] border border-white/[0.07] overflow-hidden">
        <button
          onClick={() => {
            const next = Math.max(2, workerCount - 1);
            setWorkerCount(next);
            const makeWorker = () => new Worker(`/workers/tts-worker.js?v=pcm1`, { type: 'module' });
            while (workerPoolRef.current.length < next) workerPoolRef.current.push(makeWorker());
            while (workerPoolRef.current.length > next) { try { workerPoolRef.current.pop()?.terminate(); } catch {} }
            console.log(`[Worker] Pool resized → ${workerPoolRef.current.length} workers`);
          }}
          disabled={workerCount <= 2}
          className="px-2.5 py-2 text-[#8a7e72] text-[13px] font-black hover:bg-white/[0.06] transition-colors disabled:opacity-30">−</button>
        <span className="text-[#8a7e72] text-[11px] font-black min-w-[32px] text-center">⚡{workerCount}</span>
        <button
          onClick={() => {
            const next = Math.min(4, workerCount + 1);
            setWorkerCount(next);
            const makeWorker = () => new Worker(`/workers/tts-worker.js?v=pcm1`, { type: 'module' });
            while (workerPoolRef.current.length < next) workerPoolRef.current.push(makeWorker());
            while (workerPoolRef.current.length > next) { try { workerPoolRef.current.pop()?.terminate(); } catch {} }
            console.log(`[Worker] Pool resized → ${workerPoolRef.current.length} workers`);
          }}
          disabled={workerCount >= 4}
          className="px-2.5 py-2 text-[#8a7e72] text-[13px] font-black hover:bg-white/[0.06] transition-colors disabled:opacity-30">+</button>
      </div>
    </div>
  );

  // ── Worker Panel UI ──
  const maxWorker = (() => {
    if (!hwInfo) return 4;
    const maxByRam  = Math.max(1, Math.floor((hwInfo.ram * 1024 * 0.3) / 70));
    const maxByCore = Math.max(1, Math.floor(hwInfo.cores / 2));
    return Math.max(2, Math.min(maxByRam, maxByCore, 4));
  })();

  const WorkerPanel = showWorkerPanel && (
    <div className="rounded-xl bg-[#1a1612] border border-white/[0.09] p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-black uppercase tracking-widest text-[#f0ebe4]">⚡ Luồng Generate</span>
        <button onClick={() => setShowWorkerPanel(false)} className="text-[#8a7e72] hover:text-white text-[11px]">✕</button>
      </div>

      {/* HW info */}
      {hwInfo && (
        <div className="flex gap-2 text-[9px] text-[#8a7e72]">
          <span className="px-2 py-0.5 rounded-full bg-white/[0.05]">🖥 {hwInfo.cores} cores</span>
          <span className="px-2 py-0.5 rounded-full bg-white/[0.05]">💾 {hwInfo.ram}GB RAM</span>
          <span className={`px-2 py-0.5 rounded-full ${hwInfo.isMT ? 'bg-green-900/40 text-green-400' : 'bg-yellow-900/40 text-yellow-400'}`}>
            {hwInfo.isMT ? '✓ Multi-thread' : '⚠ Single-thread'}
          </span>
        </div>
      )}

      {/* +/- buttons */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[#8a7e72]">Số luồng song song</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const next = Math.max(2, workerCount - 1);
              setWorkerCount(next);
              const makeWorker = () => new Worker(`/workers/tts-worker.js?v=pcm1`, { type: 'module' });
              while (workerPoolRef.current.length < next) workerPoolRef.current.push(makeWorker());
              while (workerPoolRef.current.length > next) { try { workerPoolRef.current.pop()?.terminate(); } catch {} }
            }}
            disabled={workerCount <= 2}
            className="w-7 h-7 rounded-lg bg-[#231f1a] border border-white/[0.07] text-white font-black text-sm disabled:opacity-30 hover:border-[#e8580a]/50 transition-colors">−</button>
          <span className="text-[15px] font-black text-[#e8580a] w-16 text-center">{workerCount} worker{workerCount > 1 ? 's' : ''}</span>
          <button
            onClick={() => {
              const next = Math.min(maxWorker, workerCount + 1);
              setWorkerCount(next);
              const makeWorker = () => new Worker(`/workers/tts-worker.js?v=pcm1`, { type: 'module' });
              while (workerPoolRef.current.length < next) workerPoolRef.current.push(makeWorker());
              while (workerPoolRef.current.length > next) { try { workerPoolRef.current.pop()?.terminate(); } catch {} }
            }}
            disabled={workerCount >= maxWorker}
            className="w-7 h-7 rounded-lg bg-[#231f1a] border border-white/[0.07] text-white font-black text-sm disabled:opacity-30 hover:border-[#e8580a]/50 transition-colors">+</button>
        </div>
      </div>

      {/* Per-worker estimate */}
      <div className="flex gap-1.5">
        {Array.from({ length: maxWorker }).map((_, i) => (
          <div key={i} className={`flex-1 h-6 rounded flex items-center justify-center text-[9px] font-bold transition-all ${
            i < workerCount
              ? 'bg-[#e8580a]/20 border border-[#e8580a]/40 text-[#e8580a]'
              : 'bg-white/[0.03] border border-white/[0.05] text-[#3a3530]'
          }`}>
            W{i + 1}
          </div>
        ))}
      </div>

      {/* RAM warning */}
      {workerCount >= 3 && workerCount * 70 > (hwInfo?.ram ?? 4) * 1024 * 0.5 && (
        <p className="text-[9px] text-yellow-400/80">⚠ {workerCount} workers ≈ {workerCount * 70}MB — có thể ảnh hưởng hiệu năng trên máy này</p>
      )}

      {hwInfo?.isMT && (
        <p className="text-[9px] text-green-400/70">✓ ONNX đang chạy multi-thread — 1 worker thường đủ nhanh</p>
      )}
    </div>
  );

  // ── Chapter row ──
  // useCallback + deps đúng để không bị stale closure với currentIdx / completedChapters
  const renderChapRow = useCallback((chap: ChapterMeta) => {
    const isActive = chap.index === currentIdx;
    const isDone   = completedChapters.has(chap.index);
    return (
      <div
        key={chap.id}
        ref={isActive ? activeChapRef : undefined}
        onClick={() => {
          setShowChapterList(false);
          goToChapter(chap); // không await — tránh block UI
        }}
        className={`flex items-center gap-3 h-[52px] px-4 cursor-pointer border-l-[3px] transition-all ${
          isActive
            ? 'bg-[#e8580a]/10 border-l-[#e8580a]'
            : 'border-l-transparent hover:bg-white/[0.04]'
        }`}
      >
        <span className={`text-[10px] font-black w-7 text-center shrink-0 ${isActive ? 'text-[#e8580a]' : 'text-[#8a7e72]'}`}>
          {chap.index}
        </span>
        <div className="flex-1 min-w-0">
          <p className={`text-[12px] ${isActive ? 'text-[#ff7c35] font-bold' : 'text-[#f0ebe4]'}`}>
            {chap.title}
          </p>
          {isActive && <p className="text-[9px] text-[#8a7e72] mt-0.5">Đang nghe</p>}
        </div>
        {isActive
          ? <WaveIcon />
          : isDone
            ? <CheckCircle2 size={13} className="text-green-500 shrink-0" />
            : <div className="w-[13px]" />}
      </div>
    );
  }, [currentIdx, completedChapters, goToChapter]);

  // 4 chương preview quanh chapter hiện tại (mobile)
  const previewChaps = (() => {
    const curPos = sortedChapters.findIndex(c => c.index === currentIdx);
    return sortedChapters.slice(curPos, curPos + 3);
  })();

  // ─────────────────────────────────────────────────────────
  // ── RENDER ──
  // ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0f0d0a] relative">
      {/* ── Version Badge ── */}
      <div className="fixed bottom-16 right-3 z-50 pointer-events-none">
        <div className="bg-[#1a1612]/90 border border-white/[0.07] rounded-lg px-2 py-1">
          <span className="text-[10px] font-black text-[#e8580a]">v5.2</span>
        </div>
      </div>

      {/* ── Loading Overlay ── */}
      {isGenerating && generatedRef.current === 0 && prefetchedPCMRef.current.length === 0 && (
        <LoadingOverlay
          chapterTitle={currentChapter.title || `Chương ${currentChapter.index}`}
          sentenceGenerated={sentenceGenerated}
          sentenceTotal={sentenceTotal}
        />
      )}

      {isIOS && (
        <div className="bg-amber-900/40 border-b border-amber-700/40 px-4 py-2 text-center">
          <p className="text-amber-300 text-xs font-medium">⚠️ iOS: Giữ màn hình sáng để nghe liên tục</p>
        </div>
      )}

      {/* ── Back + title overlay ── */}
      <div className="absolute top-3 left-3 z-40 flex items-center gap-2">
        <Link href={`/truyen/${slug}`}
          className="w-8 h-8 rounded-lg bg-black/50 backdrop-blur-sm border border-white/[0.12] flex items-center justify-center text-[#8a7e72] hover:text-white transition-colors flex-shrink-0">
          <ArrowLeft size={15} />
        </Link>
        <div className="bg-black/50 backdrop-blur-sm border border-white/[0.08] rounded-lg px-3 py-1.5 max-w-[260px] min-w-0">
          <p className="text-[12px] font-bold text-[#f0ebe4] truncate leading-tight">{storyTitle}</p>
          <p className="text-[9px] text-[#8a7e72] leading-tight">Đang nghe · {author}</p>
        </div>
        <button onClick={() => setShowChapterList(true)}
          className="lg:hidden w-8 h-8 rounded-lg bg-black/50 backdrop-blur-sm border border-white/[0.12] flex items-center justify-center text-[#8a7e72] hover:text-white transition-colors">
          <List size={15} />
        </button>
      </div>

      {/* ════ MOBILE (< lg) — full screen như mockup ════ */}
      <div className="lg:hidden relative min-h-screen">
        {/* Cover full screen */}
        <div className="absolute inset-0">
          {storyCover
            ? <>
                <div className="absolute inset-0 bg-cover bg-center opacity-20 blur-xl scale-110"
                  style={{ backgroundImage: `url(${storyCover})` }} />
                <img src={storyCover} alt={storyTitle}
                  className="absolute inset-0 w-full h-full object-contain" />
              </>
            : <div className="absolute inset-0 bg-gradient-to-br from-[#3d1f08] to-[#0f0d0a]" />}
          <div className="absolute bottom-0 left-0 right-0 h-[480px] bg-gradient-to-t from-[#0f0d0a] via-[#0f0d0a]/80 to-transparent" />
        </div>

        {/* Controls căn bottom */}
        <div className="relative flex flex-col justify-end min-h-screen pb-7">
          <div className="mt-auto">
            <div className="px-6 pb-3">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[#e8580a]/50 bg-[#e8580a]/10 mb-2">
                <Headphones size={9} className="text-[#e8580a]" />
                <span className="text-[9px] font-black tracking-[.12em] uppercase text-[#e8580a]">Chương {currentIdx}</span>
              </div>
              <h1 className="font-serif text-[18px] font-bold text-[#f0ebe4] leading-tight mb-1">
                {currentChapter.title || `Chương ${currentIdx}`}
              </h1>
              <p className="text-[11px] text-[#8a7e72]">{author}</p>
            </div>
            <div className="px-6 flex flex-col gap-3">
              {DebugPanel}
              {Controls}
              {VoiceSpeed}
              {WorkerPanel}
            </div>
            <div className="px-6 mt-3 border-t border-white/[0.06] pt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-[.1em] text-[#f0ebe4]">Danh sách chương</span>
                <button onClick={() => setShowChapterList(true)}
                  className="bg-[#1a1612] border border-white/[0.07] rounded-lg px-2.5 py-1 text-[10px] font-bold text-[#e8580a]">
                  Xem tất cả ›
                </button>
              </div>
              {previewChaps.map(renderChapRow)}
            </div>
          </div>
        </div>
      </div>

      {/* ════ DESKTOP (≥ lg) — 9/3 ════ */}
      <div className="hidden lg:grid lg:grid-cols-12 h-screen">

        {/* LEFT 9 cols — cover full + controls căn bottom */}
        <div className="col-span-9 relative overflow-hidden">
          {/* Cover full */}
          <div className="absolute inset-0 flex items-center justify-center bg-[#0a0806]">
            {storyCover && (
              <div className="absolute inset-0 bg-cover bg-center opacity-20 blur-xl scale-110"
                style={{ backgroundImage: `url(${storyCover})` }} />
            )}
            {storyCover
              ? <img src={storyCover} alt={storyTitle} className="relative z-10 max-h-full max-w-full object-contain drop-shadow-2xl" style={{ maxHeight: '70%' }} />
              : <div className="absolute inset-0 bg-gradient-to-br from-[#4a2f10] to-[#1a0e06] flex items-center justify-center">
                  <Headphones size={80} className="text-[#e8580a]/20" />
                </div>}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0f0d0a] via-[#0f0d0a]/30 to-transparent" />
          </div>

          {/* Controls căn bottom */}
          <div className="absolute bottom-0 left-0 right-0 px-8 pb-8 flex flex-col gap-5">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[#e8580a]/50 bg-[#e8580a]/10 mb-2">
                <Headphones size={9} className="text-[#e8580a]" />
                <span className="text-[9px] font-black tracking-[.12em] uppercase text-[#e8580a]">Chương {currentIdx}</span>
              </div>
              <h1 className="font-serif text-[22px] font-bold text-[#f0ebe4] leading-tight mb-1">
                {currentChapter.title || `Chương ${currentIdx}`}
              </h1>
              <p className="text-[12px] text-[#8a7e72]">{author}</p>
            </div>
            {DebugPanel}
            {Controls}
            {VoiceSpeed}
            {WorkerPanel}
          </div>
        </div>

        {/* RIGHT 3 cols — infinite scroll chapter list */}
        <div className="col-span-3 flex flex-col bg-[#0d0b08] border-l border-white/[0.06] h-screen">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] flex-shrink-0">
            <span className="text-[10px] font-black uppercase tracking-[.12em] text-[#f0ebe4]">Danh sách chương</span>
            <span className="text-[10px] text-[#8a7e72]">{totalChapters} chương</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {sortedChapters.slice(0, desktopVisible).map(renderChapRow)}
            {desktopVisible < sortedChapters.length && (
              <div ref={desktopSentinelRef} className="h-12 flex items-center justify-center">
                <span className="text-[10px] text-[#8a7e72] animate-pulse">Đang tải thêm...</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ════ MOBILE CHAPTER DRAWER ════ */}
      {showChapterList && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col bg-[#0f0d0a]/96 backdrop-blur-sm">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.07] flex-shrink-0">
            <span className="text-[13px] font-black text-[#f0ebe4] uppercase tracking-[.08em]">Tất cả chương</span>
            <button onClick={() => setShowChapterList(false)}
              className="w-8 h-8 rounded-lg bg-white/[0.07] flex items-center justify-center text-[#8a7e72]">
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto" ref={chapListRef}>
            {sortedChapters.slice(0, mobileVisible).map(renderChapRow)}
            {mobileVisible < sortedChapters.length && (
              <div ref={mobileSentinelRef} className="h-12 flex items-center justify-center">
                <span className="text-[10px] text-[#8a7e72] animate-pulse">Đang tải thêm...</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
