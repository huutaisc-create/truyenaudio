'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Headphones, SkipBack, SkipForward,
  Play, Pause, RotateCcw, RotateCw, ChevronDown,
  CheckCircle2, List,
} from 'lucide-react';

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ── R2 CDN base URL ──────────────────────────────────────────────────────
// Đổi URL này khi có custom domain, không cần sửa chỗ nào khác
const R2_BASE = 'https://pub-e24f7ec645fc49d79de9bf92a252cc29.r2.dev';

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
  storyId: string;
  storyTitle: string;
  storyCover: string | null;
  author: string;
  totalChapters: number;
  initialChapters: ChapterMeta[];
  initialChapterIndex: number;
  initialChapter: Chapter;
}

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function cleanTitle(title: string, index: number): string {
  return title
    .replace(new RegExp(`^C${index}\s+`, 'i'), '')   // bá» "C3 "
    .replace(/^ChÆ°Æ¡ng\s*\d+\s*/i, '')               // bá» "ChÆ°Æ¡ng 3 "
    .trim();
}

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}
const MIN_SPEED = 0.7;
const MAX_SPEED = 2.0;
const SPEED_STEP = 0.05;
const PAGE_SIZE = 20;

// â”€â”€â”€ Wave Icon â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€â”€ Loading Overlay â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function LoadingOverlay({ chapterTitle, sentenceGenerated, sentenceTotal }: {
  chapterTitle: string;
  sentenceGenerated: number;
  sentenceTotal: number;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0f0d0a]/90 backdrop-blur-md">
      {/* SĂ³ng Ă¢m */}
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
        Äang táº¡o audio
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
        <span className="text-[11px] text-[#8a7e72] font-medium ml-1">Vui lĂ²ng chá» trong giĂ¢y lĂ¡t</span>
      </div>

      {/* Counter */}
      <p className="text-[11px] text-[#8a7e72] font-medium tabular-nums">
        Äang xá»­ lĂ½ cĂ¢u {sentenceGenerated} / {sentenceTotal > 0 ? sentenceTotal : '...'}
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

// â”€â”€â”€ Main â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function ListeningMobileAndroid({
  slug, storyId, storyTitle, storyCover, author,
  totalChapters, initialChapters, initialChapterIndex, initialChapter,
}: Props) {
  const [allChapters, setAllChapters] = useState<ChapterMeta[]>(initialChapters);
  const chapPageRef    = useRef<number>(1);
  const chapLoadingRef = useRef<boolean>(false);
  const hasMoreChaps   = allChapters.length < totalChapters;

  const loadMoreChapters = useCallback(async () => {
    if (chapLoadingRef.current || allChapters.length >= totalChapters) return;
    chapLoadingRef.current = true;
    const nextPage = chapPageRef.current + 1;
    try {
      const res  = await fetch(`/api/chapters/toc?storyId=${storyId}&page=${nextPage}`);
      const json = await res.json();
      const newChaps: ChapterMeta[] = (json.data?.chapters ?? []).map((c: any) => ({
        id: c.id,
        index: c.index,
        title: c.title || `ChÆ°Æ¡ng ${c.index}`,
      }));
      if (newChaps.length > 0) {
        setAllChapters(prev => {
          const existingIds = new Set(prev.map(c => c.id));
          return [...prev, ...newChaps.filter(c => !existingIds.has(c.id))];
        });
        chapPageRef.current = nextPage;
      }
    } catch (e) {
      console.error('[ChapterList] loadMore error', e);
    } finally {
      chapLoadingRef.current = false;
    }
  }, [storyId, allChapters.length, totalChapters]);
  const router = useRouter();

  // â”€â”€ Audio engine refs â”€â”€
  const actxRef      = useRef<AudioContext | null>(null);
  const nextStartRef = useRef<number>(0);
  const stopFlagRef  = useRef<boolean>(false);
  const speedRef     = useRef<number>(1);

  // â”€â”€ Player state â”€â”€
  const [isPlaying,         setIsPlaying]         = useState(false);
  const [speed,             setSpeed]              = useState(1.0);
  const [isGenerating,      setIsGenerating]       = useState(false);

  // â”€â”€ Debug state â”€â”€
  const [sentencePlayed,    setSentencePlayed]    = useState(0);
  const [sentenceGenerated, setSentenceGenerated] = useState(0);
  const [sentenceTotal,     setSentenceTotal]     = useState(0);
  const [ramMB,             setRamMB]             = useState<number | null>(null);

  // â”€â”€ Chapter state â”€â”€
  const [currentChapter,    setCurrentChapter]    = useState<Chapter>(initialChapter);
  const [loadedChapters,    setLoadedChapters]    = useState<Record<number, Chapter>>({
    [initialChapter.index]: initialChapter,
  });
  const [completedChapters, setCompletedChapters] = useState<Set<number>>(new Set());

  // â”€â”€ Voice state â”€â”€
  const [voices,        setVoices]       = useState<{ id: string; name: string; path?: string }[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [showVoiceMenu, setShowVoiceMenu] = useState(false);

  // â”€â”€ Worker settings â”€â”€
  const [showWorkerPanel, setShowWorkerPanel] = useState(false);
  const [workerCount,     setWorkerCount]     = useState(2); // máº·c Ä‘á»‹nh 2
  const [hwInfo, setHwInfo] = useState<{ cores: number; ram: number; isMT: boolean } | null>(null);

  // â”€â”€ Chapter list UI â”€â”€
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

  // â”€â”€ Detect hardware info khi mount â”€â”€
  useEffect(() => {
    const cores = navigator.hardwareConcurrency ?? 2;
    const ram   = (navigator as any).deviceMemory ?? 4;
    const isMT  = typeof self !== 'undefined' && (self as any).crossOriginIsolated === true;
    const maxByRam  = Math.max(1, Math.floor((ram * 1024 * 0.3) / 70));
    const maxByCore = Math.max(1, Math.floor(cores / 2));
    const autoMax   = Math.min(maxByRam, maxByCore, 4);
    setHwInfo({ cores, ram, isMT });
    // Auto set vá» max náº¿u máº·c Ä‘á»‹nh 2 vÆ°á»£t quĂ¡ giá»›i háº¡n
    setWorkerCount(w => Math.max(2, Math.min(w, Math.max(2, autoMax))));
  }, []);

  // â”€â”€ Load voice manifest â”€â”€
  useEffect(() => {
    fetch(`${R2_BASE}/models/custom/manifest.json`)
      .then(r => r.json())
      .then((data: { id: string; name: string; path?: string }[]) => {
        setVoices(data);
        if (data.length > 0) setSelectedVoice(data[0].id);
      })
      .catch(() => {
        setVoices([{ id: 'default', name: 'Giá»ng máº·c Ä‘á»‹nh' }]);
        setSelectedVoice('default');
      });
  }, []);

  // â”€â”€ Sync speedRef â”€â”€
  useEffect(() => { speedRef.current = speed; }, [speed]);

  // â”€â”€ Media Session â”€â”€
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentChapter.title || `ChÆ°Æ¡ng ${currentIdx}`,
      artist: author, album: storyTitle,
      artwork: storyCover ? [{ src: storyCover, sizes: '512x512', type: 'image/jpeg' }] : [],
    });
    navigator.mediaSession.setActionHandler('previoustrack', () => goChapter('prev'));
    navigator.mediaSession.setActionHandler('nexttrack',     () => goChapter('next'));
  }, [currentChapter]);

  // â”€â”€ Scroll active chapter vĂ o view â”€â”€
  useEffect(() => {
    if (showChapterList) {
      const curPos = sortedChapters.findIndex(c => c.index === currentIdx);
      // Äáº£m báº£o active chapter náº±m trong range Ä‘Ă£ render
      setMobileVisible(prev => Math.max(prev, curPos + 5));
      setTimeout(() => {
        activeChapRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 80);
    }
  }, [showChapterList]);

  // â”€â”€ Scroll active chapter trĂªn desktop vĂ o view khi mount â”€â”€
  useEffect(() => {
    const curPos = sortedChapters.findIndex(c => c.index === currentIdx);
    setDesktopVisible(prev => Math.max(prev, curPos + 5));
  }, [currentIdx]);

  // â”€â”€ IntersectionObserver: mobile drawer â”€â”€
  useEffect(() => {
    const el = mobileSentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        setMobileVisible(prev => Math.min(prev + PAGE_SIZE, sortedChapters.length));
        loadMoreChapters();
      }
    }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [showChapterList, sortedChapters.length, loadMoreChapters]);

  // â”€â”€ IntersectionObserver: desktop panel â”€â”€
  useEffect(() => {
    const el = desktopSentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        setDesktopVisible(prev => Math.min(prev + PAGE_SIZE, sortedChapters.length));
        loadMoreChapters();
      }
    }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [sortedChapters.length, loadMoreChapters]);

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // â”€â”€ Audio core â”€â”€
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    // Terminate toĂ n bá»™ worker pool
    for (const w of workerPoolRef.current) {
      try { w?.terminate(); } catch {}
    }
    workerPoolRef.current = [];
    piperRef.current = null;
    // Dá»n prefetch state â€” trĂ¡nh rĂ¡c khi chuyá»ƒn chÆ°Æ¡ng báº¥t ngá»
    prefetchedPCMRef.current  = [];
    prefetchDoneRef.current   = false;
    prefetchedChapRef.current = null;
    prefetchingIdRef.current  = null;
    prefetchStopRef.current   = true;
    prefetchTotalRef.current  = 0;
  }, []);

  // trimSilence: cáº¯t bá» silence á»Ÿ Ä‘áº§u/cuá»‘i PCM
  // threshold: sample pháº£i vÆ°á»£t má»©c nĂ y má»›i tĂ­nh lĂ  "cĂ³ Ă¢m thanh"
  // margin: giá»¯ láº¡i vĂ i ms Ä‘á»ƒ trĂ¡nh click artifact
  const trimSilence = useCallback((pcm: Float32Array, sampleRate: number, thresholdDb = -45): Float32Array => {
    const threshold = Math.pow(10, thresholdDb / 20); // -45dB â‰ˆ 0.006
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

  // schedulePCM: nháº­n raw PCM Float32Array â†’ táº¡o AudioBuffer â†’ schedule
  // pauseMs: khoáº£ng nghá»‰ tá»± nhiĂªn sau chunk (ms) â€” context-aware
  const schedulePCM = useCallback((
    actx: AudioContext,
    pcm: Float32Array,
    sampleRate: number,
    isClauseBoundary = false,
    pauseMs = 150,
    onEnded?: () => void,
  ): number => {
    try {
      // KhĂ´ng trim silence â€” Piper tá»± generate silence Ä‘Ăºng chá»—
      const audioBuffer = actx.createBuffer(1, pcm.length, sampleRate);
      const channel = audioBuffer.getChannelData(0);
      channel.set(pcm);

      const s       = speedRef.current;
      const startAt = Math.max(actx.currentTime, nextStartRef.current);

      // Fade-in 10ms Ä‘áº§u chunk + fade-out 10ms cuá»‘i chunk â€” giáº£m click/pop
      const endAt    = startAt + audioBuffer.duration / s;
      const gainNode = actx.createGain();
      gainNode.connect(actx.destination);
      // Fade-in: luĂ´n apply Ä‘á»ƒ trĂ¡nh click khi chunk báº¯t Ä‘áº§u
      gainNode.gain.setValueAtTime(0, startAt);
      gainNode.gain.linearRampToValueAtTime(1, startAt + 0.01); // 10ms fade in
      // Fade-out: 10ms trÆ°á»›c khi chunk káº¿t thĂºc
      gainNode.gain.setValueAtTime(1, Math.max(startAt + 0.01, endAt - 0.01));
      gainNode.gain.linearRampToValueAtTime(0, endAt);

      const source = actx.createBufferSource();
      source.buffer             = audioBuffer;
      source.playbackRate.value = s;
      source.connect(gainNode);
      source.start(startAt);
      // Disconnect sau khi play xong â€” trĂ¡nh memory leak trĂªn chapter dĂ i
      // onEnded callback cho chunk cuá»‘i â†’ trigger auto-next (hoáº¡t Ä‘á»™ng khi táº¯t mĂ n hĂ¬nh)
      source.onended = () => {
        source.disconnect();
        gainNode.disconnect();
        onEnded?.();
      };

      // Pause tá»± nhiĂªn sau chunk â€” chia cho speed vĂ¬ audio cháº¡y nhanh hÆ¡n
      const pauseSec = (pauseMs / 1000) / s;
      nextStartRef.current = startAt + audioBuffer.duration / s + pauseSec;

      return nextStartRef.current;
    } catch {
      return nextStartRef.current;
    }
  }, [trimSilence]);

  // scheduleChunk legacy â€” backward compat náº¿u cáº§n
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

  // â”€â”€ Pipeline refs â”€â”€
  const endTimesRef      = useRef<number[]>([]);
  const generatedRef     = useRef<number>(0);
  const pipelineDone     = useRef<boolean>(false);
  const audioHandledGlobalRef  = useRef<boolean>(false); // guard chung cho pollPlayed + pollFromBuffer â€” trĂ¡nh double auto-next
  const activeChapIndexRef     = useRef<number>(-1);     // index chÆ°Æ¡ng Ä‘ang active â€” pollPlayed/pollFromBuffer stale tá»± dá»«ng
  const autoNextCallbackRef    = useRef<(() => void) | null>(null); // callback khi chunk cuá»‘i káº¿t thĂºc â†’ auto-next (Android: onended thay setTimeout)
  const streamChapterRef            = useRef<((ch: Chapter) => Promise<void>) | null>(null);
  const playFromPrefetchBufferRef   = useRef<((ch: Chapter) => void) | null>(null);
  const piperRef         = useRef<any>(null); // giá»¯ worker sá»‘ng â†’ khĂ´ng load láº¡i model má»—i chÆ°Æ¡ng
  const workerPoolRef    = useRef<any[]>([]);  // pool nhiá»u worker theo pháº§n cá»©ng
  const workerCountRef   = useRef<number>(1);  // sá»‘ worker thá»±c táº¿ dĂ¹ng

  const BUFFER_AHEAD = 4;

  // â”€â”€ Prefetch chÆ°Æ¡ng tiáº¿p theo â”€â”€
  const prefetchedChapRef    = useRef<Chapter | null>(null);      // chapter metadata
  const prefetchedPCMRef     = useRef<Array<{ pcm: Float32Array; sampleRate: number; isClause: boolean; pauseMs: number }>>([]);
  const prefetchDoneRef      = useRef<boolean>(false);
  const prefetchingIdRef     = useRef<string | null>(null);
  const prefetchNextChapterRef = useRef<((meta: { id: string; index: number; title: string }) => void) | null>(null);
  const prefetchStopRef      = useRef<boolean>(false);
  const prefetchTotalRef     = useRef<number>(0);  // tá»•ng chunks cá»§a chÆ°Æ¡ng Ä‘ang prefetch â€” biáº¿t ngay sau splitChunks

  // detectWorkerCount Ä‘á»c tá»« state workerCount (do user chá»n)
  const detectWorkerCount = useCallback(() => workerCount, [workerCount]);

  // â”€â”€ Sub-sentence splitter â”€â”€
  // Target 40-80 chars/chunk â€” sweet spot VITS inference latency
  // Tá»« ná»‘i quan trá»ng â†’ pause dĂ i hÆ¡n
  const CONNECTORS = /^(nhÆ°ng|tuy nhiĂªn|vĂ¬ váº­y|do Ä‘Ă³|tuy váº­y|máº·c dĂ¹|tháº¿ nhÆ°ng|bá»Ÿi vĂ¬|vĂ¬ tháº¿|cho nĂªn)/i;

  // Äáº¿m sá»‘ tá»« tiáº¿ng Viá»‡t
  const countWords = (s: string) => s.trim().split(/\s+/).length;

  const splitChunks = useCallback((text: string): Array<{ text: string; isClause: boolean; pauseMs: number }> => {
    const raw: Array<{ text: string; isClause: boolean; pauseMs: number }> = [];

    // TĂ¡ch theo paragraph (\n) trÆ°á»›c â€” pause dĂ i nháº¥t
    const paragraphs = text.split(/\n+/);

    for (let pi = 0; pi < paragraphs.length; pi++) {
      const para = paragraphs[pi].trim();
      if (!para) continue;

      // TĂ¡ch cĂ¢u theo .!?â€¦
      const sentences = para.match(/[^.!?â€¦]+(?:[.!?](?![.!?])|â€¦|\.{3})+|[^.!?â€¦]+$/g) ?? [para];

      for (let si = 0; si < sentences.length; si++) {
        const sent = sentences[si].trim();
        if (!sent) continue;

        const isLastSentenceInPara = si === sentences.length - 1;
        const isLastPara           = pi === paragraphs.length - 1;
        const hasEllipsis          = /\.{3}|â€¦/.test(sent);
        const hasDash              = /[\u2014\u2013]/.test(sent);

        // CĂ¢u ngáº¯n â‰¤ 15 tá»« â†’ khĂ´ng tĂ¡ch thĂªm
        if (countWords(sent) <= 15) {
          let pauseMs = 400;
          if (isLastSentenceInPara && !isLastPara) pauseMs = 640;
          else if (hasEllipsis || hasDash) pauseMs = 288;
          raw.push({ text: sent, isClause: false, pauseMs });
          continue;
        }

        // CĂ¢u dĂ i â†’ tĂ¡ch theo dáº¥u phá»¥: , ; : â€” â€¦
        const parts: string[] = [];
        let buf = '';
        for (let ci = 0; ci < sent.length; ci++) {
          buf += sent[ci];
          const ch = sent[ci];
          const isBreak = /[,;:\u2014\u2013]/.test(ch);
          if (isBreak && countWords(buf) >= 4) { parts.push(buf.trim()); buf = ''; }
        }
        if (buf.trim()) parts.push(buf.trim());

        // Merge part < 4 tá»« vá»›i part sau
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
          const partHasEllipsis = /\.{3}|â€¦/.test(p);

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

    // Merge chunk < 3 tá»« vá»›i chunk káº¿
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


  // â”€â”€ prefetchNextChapter: generate ngáº§m chÆ°Æ¡ng tiáº¿p theo â€” pipeline song song nhÆ° streamChapter â”€â”€
  const prefetchNextChapter = useCallback(async (nextMeta: { id: string; index: number; title: string }) => {
    if (prefetchedChapRef.current?.id === nextMeta.id && prefetchDoneRef.current) {
      console.log(`[W:Prefetch] SKIP: already done id=${nextMeta.id}`);
      return;
    }

    // â”€â”€ Resume case: goToChapter Ä‘Ă£ restore buffer partial + spawn workers má»›i â”€â”€
    // Nháº­n ra báº±ng: cĂ¹ng id + chÆ°a done + Ä‘Ă£ cĂ³ chap + Ä‘Ă£ cĂ³ chunks trong buffer
    const isResume = prefetchingIdRef.current === nextMeta.id
                  && !prefetchDoneRef.current
                  && prefetchedChapRef.current?.id === nextMeta.id
                  && prefetchedPCMRef.current.length > 0;

    let chap: Chapter;
    let resumeFromIndex = 0;

    if (isResume) {
      console.log(`[W:Prefetch] RESUME: id=${nextMeta.id} tá»« chunk ${prefetchedPCMRef.current.length}`);
      prefetchStopRef.current = false;
      chap = prefetchedChapRef.current!;
      resumeFromIndex = prefetchedPCMRef.current.length;
    } else {
      console.log(`[W:Prefetch] START: id=${nextMeta.id} title="${nextMeta.title}"`);

      // Set ngay láº­p tá»©c Ä‘á»ƒ trĂ¡nh gá»i láº¡i nhiá»u láº§n tá»« pollPlayed
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
    const modelBase = `${R2_BASE}/models/custom/${voiceMeta?.path ?? selectedVoice}`;
    const workerBase = {
      modelUrl:              `${modelBase}.onnx`,
      modelConfigUrl:        `${modelBase}.onnx.json`,
      onnxruntimeUrl:        `${R2_BASE}/piper-wasm`,
      piperPhonemizeJsUrl:   `${R2_BASE}/piper-wasm/piper_phonemize.js`,
      piperPhonemizeWasmUrl: `${R2_BASE}/piper-wasm/piper_phonemize.wasm`,
      piperPhonemizeDataUrl: `${R2_BASE}/piper-wasm/piper_phonemize.data`,
      blobs: {},
    };

    const text   = stripHtml((chap.title ? `ChÆ°Æ¡ng ${chap.index}. ${cleanTitle(chap.title, chap.index)}. ` : '') + chap.content);
    const chunks = splitChunks(text);
    const total  = chunks.length;
    prefetchTotalRef.current = total; // biáº¿t tá»•ng ngay sau splitChunks â†’ playFromPrefetchBuffer dĂ¹ng Ä‘Æ°á»£c

    // â”€â”€ Song song nhÆ° streamChapter â”€â”€
    // phonemeQueue + resolvers Ä‘á»ƒ stage1 notify stage2 ngay láº­p tá»©c
    const phonemeQueue: Array<{ ids: number[]; isClause: boolean; pauseMs: number } | null> = new Array(total).fill(null);
    const phonemeResolvers: Array<((val: { ids: number[]; isClause: boolean; pauseMs: number }) => void) | null> = new Array(total).fill(null);

    const waitPhoneme = (i: number): Promise<{ ids: number[]; isClause: boolean; pauseMs: number }> => {
      if (phonemeQueue[i]) return Promise.resolve(phonemeQueue[i]!);
      return new Promise(resolve => { phonemeResolvers[i] = resolve; });
    };

    // Stage 1: phonemize â€” resume: bá» qua chunks Ä‘Ă£ cĂ³, báº¯t Ä‘áº§u tá»« resumeFromIndex
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

    // Stage 2: N infer workers cháº¡y song song â€” lÆ°u PCM theo thá»© tá»±
    // Resume: pcmBuffer giá»¯ láº¡i pháº§n Ä‘Ă£ cĂ³, nextTask báº¯t Ä‘áº§u tá»« resumeFromIndex
    const pcmBuffer: Array<{ pcm: Float32Array; sampleRate: number; isClause: boolean; pauseMs: number } | null> = new Array(total).fill(null);
    // Restore pháº§n Ä‘Ă£ cĂ³ vĂ o pcmBuffer (resume case)
    for (let i = 0; i < resumeFromIndex; i++) {
      if (prefetchedPCMRef.current[i]) pcmBuffer[i] = prefetchedPCMRef.current[i];
    }
    let nextTask = resumeFromIndex; // resume: bá» qua chunks Ä‘Ă£ cĂ³

    const consumers = pool.map((worker: Worker, wIdx: number) => {
      if (pool.length > 1 && wIdx === 0) return Promise.resolve(); // worker[0] dĂ nh phonemize
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
              // Push ngay vĂ o prefetchedPCMRef Ä‘á»ƒ pollNewChunks schedule Ä‘Æ°á»£c
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
      console.log(`[W:Prefetch] Done: ${chap.title} id=${chap.id} â€” ${prefetchedPCMRef.current.length} chunks`);
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

    // Worker pool â€” raw Worker (khĂ´ng qua Piper class)
    const workerCount = detectWorkerCount();
    workerCountRef.current = workerCount;
    const makeWorker = () => new Worker(`/workers/tts-worker.js?v=pcm1`, { type: 'module' });
    while (workerPoolRef.current.length < workerCount) workerPoolRef.current.push(makeWorker());
    while (workerPoolRef.current.length > workerCount) {
      try { workerPoolRef.current.pop()?.terminate(); } catch {}
    }
    console.log(`[TTS] Worker pool: ${workerPoolRef.current.length} workers â€” phonemize=worker[0], infer=worker[1..${workerPoolRef.current.length - 1}]`);
    console.log(`[TTS] Chapter: ${chapter.title} â€” chunks will be split from text`);

    const voiceMeta = voices.find(v => v.id === selectedVoice);
    const modelBase = `${R2_BASE}/models/custom/${voiceMeta?.path ?? selectedVoice}`;
    const workerBase = {
      modelUrl:              `${modelBase}.onnx`,
      modelConfigUrl:        `${modelBase}.onnx.json`,
      onnxruntimeUrl:        `${R2_BASE}/piper-wasm`,
      piperPhonemizeJsUrl:   `${R2_BASE}/piper-wasm/piper_phonemize.js`,
      piperPhonemizeWasmUrl: `${R2_BASE}/piper-wasm/piper_phonemize.wasm`,
      piperPhonemizeDataUrl: `${R2_BASE}/piper-wasm/piper_phonemize.data`,
      blobs: {},
    };

    const text   = stripHtml((chapter.title ? chapter.title + '. ' : '') + chapter.content);
    const chunks = splitChunks(text);
    setSentenceTotal(chunks.length);

    const chapIndex = chapter.index;

    // phonemeQueue[i]: null = chÆ°a xong, object = Ä‘Ă£ cĂ³ phonemeIds
    const phonemeQueue: Array<{ ids: number[]; isClause: boolean; pauseMs: number } | null> = new Array(chunks.length).fill(null);
    // phonemeResolvers[i]: resolve callback â€” notify consumer ngay khi phonemize xong
    const phonemeResolvers: Array<((val: { ids: number[]; isClause: boolean; pauseMs: number }) => void) | null> = new Array(chunks.length).fill(null);

    // Stage 1: phonemize toĂ n bá»™ chunks trĂªn worker[0] tuáº§n tá»± (nhanh, ~vĂ i ms/chunk)
    // Cháº¡y song song vá»›i stage 2 bĂªn dÆ°á»›i
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
              // Notify consumer ngay láº­p tá»©c â€” khĂ´ng cáº§n polling
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

    

    // â”€â”€ handleChapterEnd: Ä‘Æ°á»£c gá»i tá»« onEnded chunk cuá»‘i â€” hoáº¡t Ä‘á»™ng khi táº¯t mĂ n hĂ¬nh â”€â”€
    const handleChapterEnd = () => {
      if (audioHandledGlobalRef.current) return;
      if (activeChapIndexRef.current !== chapIndex) return;
      audioHandledGlobalRef.current = true;
      setSentencePlayed(generatedRef.current);
      setIsPlaying(false);
      setCompletedChapters(prev => new Set(prev).add(chapIndex));

      const sorted2  = [...allChapters].sort((a, b) => a.index - b.index);
      const nextMeta = sorted2.find(c => c.index > chapIndex);
      console.log(`[W:AutoNext] onEnded â€” nextMeta=${nextMeta?.id ?? 'null'} prefetchDone=${prefetchDoneRef.current}`);
      if (!nextMeta) { console.log('[W:AutoNext] KhĂ´ng cĂ³ chÆ°Æ¡ng tiáº¿p â€” dá»«ng'); return; }

      const hasPrefetch = prefetchedChapRef.current?.id === nextMeta.id &&
                          (prefetchDoneRef.current || prefetchingIdRef.current === nextMeta.id);
      if (hasPrefetch) {
        const nextChap = prefetchedChapRef.current!;
        setLoadedChapters(prev => ({ ...prev, [nextMeta.index]: nextChap }));
        setCurrentChapter(nextChap);
        router.replace(`/truyen/${slug}/nghe?chuong=${nextMeta.index}`, { scroll: false });
        playFromPrefetchBuffer(nextChap);
      } else {
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
    };
    autoNextCallbackRef.current = handleChapterEnd;

    // â”€â”€ pollPlayed: chá»‰ Ä‘á»ƒ update UI sentencePlayed â€” khĂ´ng dĂ¹ng Ä‘á»ƒ auto-next â”€â”€
    const pollPlayed = () => {
      if (stopFlagRef.current) { console.log('[W:Poll] stopped by stopFlag'); return; }
      if (audioHandledGlobalRef.current) return;
      if (activeChapIndexRef.current !== chapIndex) { console.log(`[W:Poll] stale â€” chapIndex=${chapIndex} active=${activeChapIndexRef.current} â€” dá»«ng`); return; }
      const actxNow = actxRef.current;
      if (!actxNow) { console.log('[W:Poll] no actx â€” actxRef null'); return; }
      const now = actxNow.currentTime;

      const played = endTimesRef.current.filter(t => t <= now).length;
      setSentencePlayed(played);

      const nWorkers = workerPoolRef.current.length;
      const estimateWorkerMB = nWorkers * 62 + 10;
      if ((performance as any).measureUserAgentSpecificMemory) {
        (performance as any).measureUserAgentSpecificMemory()
          .then((result: any) => { setRamMB(Math.round(result.bytes / 1024 / 1024)); })
          .catch(() => {
            const mem = (performance as any).memory;
            const jsMB = mem ? Math.round(mem.totalJSHeapSize / 1024 / 1024) : 0;
            setRamMB(jsMB + estimateWorkerMB);
          });
      } else {
        const mem = (performance as any).memory;
        const jsMB = mem ? Math.round(mem.totalJSHeapSize / 1024 / 1024) : 0;
        setRamMB(jsMB + estimateWorkerMB);
      }

      if (!audioHandledGlobalRef.current) setTimeout(pollPlayed, 500);
    };

    try {
      // â”€â”€ Task Queue + PCM pipeline â”€â”€
      // Stage 1: worker[0] phonemize táº¥t cáº£ chunks â†’ phonemeQueue (nhanh, song song)
      // Stage 2: N workers láº¥y phonemeIds â†’ ONNX infer â†’ raw PCM â†’ schedulePCM
      // Thá»© tá»± audio: slotPromise chain

      const pool  = workerPoolRef.current;
      const total = chunks.length;

      const slotReady:   Array<() => void>    = new Array(total);
      const slotPromise: Array<Promise<void>> = Array.from({ length: total }, (_, i) =>
        new Promise<void>(res => { slotReady[i] = res; })
      );

      let nextTask = 0;

      // Chá» phonemeQueue[i] sáºµn sĂ ng â€” Promise, khĂ´ng polling
      const waitPhoneme = (i: number): Promise<{ ids: number[]; isClause: boolean; pauseMs: number }> => {
        if (phonemeQueue[i]) return Promise.resolve(phonemeQueue[i]!);
        return new Promise(resolve => { phonemeResolvers[i] = resolve; });
      };

      // Consumer: worker[wIdx] láº¥y tasks, infer, schedule PCM
      // Worker[0] Ä‘ang lĂ m phonemize â†’ náº¿u cĂ³ > 1 worker thĂ¬ worker[0] chá»‰ phonemize
      const consumers = pool.map((worker: Worker, wIdx: number) => {
        if (pool.length > 1 && wIdx === 0) return Promise.resolve(); // worker[0] dĂ nh cho phonemize
        return (async () => {
          while (true) {
            if (stopFlagRef.current) break;
            if (nextTask >= total) break;
            const i = nextTask++;

            const { ids: phonemeIds, isClause, pauseMs } = await waitPhoneme(i);
            if (stopFlagRef.current) { slotReady[i](); break; }

            // Gá»­i infer job â€” nháº­n raw PCM qua Transferable
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

            // Chá» chunk trÆ°á»›c schedule xong (Ä‘áº£m báº£o thá»© tá»± audio)
            if (i > 0) await slotPromise[i - 1];
            if (stopFlagRef.current) { slotReady[i](); break; }

            // Schedule PCM trá»±c tiáº¿p â€” zero-copy, khĂ´ng WAV, khĂ´ng Blob
            // Chunk cuá»‘i (i === total-1) truyá»n handleChapterEnd vĂ o onEnded
            const isLastChunk = i === total - 1;
            const endTime = schedulePCM(actx, pcmResult.pcm, pcmResult.sampleRate, isClause, pauseMs,
              isLastChunk ? () => autoNextCallbackRef.current?.() : undefined
            );
            endTimesRef.current.push(endTime);
            generatedRef.current++;
            setSentenceGenerated(generatedRef.current);
            console.log(`[Worker:${wIdx}] chunk ${i}/${total-1} infer done â€” generated=${generatedRef.current}`);
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

      // Trigger prefetch náº¿u chÆ°a Ä‘Æ°á»£c trigger tá»« BUFFER_AHEAD
      const sortedP   = [...allChapters].sort((a, b) => a.index - b.index);
      const nextMetaP = sortedP.find(c => c.index > chapIndex);
      console.log(`[W:Finally] pipelineDone â€” chapIndex=${chapIndex} nextMeta=${nextMetaP?.id ?? 'null'} prefetchingId=${prefetchingIdRef.current} prefetchDone=${prefetchDoneRef.current}`);
      if (nextMetaP && prefetchingIdRef.current !== nextMetaP.id && !prefetchDoneRef.current) {
        console.log(`[W:Finally] Trigger prefetch (chÆ°a cĂ³ tá»« BUFFER_AHEAD): ${nextMetaP.id}`);
        prefetchingIdRef.current = nextMetaP.id;
        prefetchNextChapter(nextMetaP);
      } else {
        console.log(`[W:Finally] Prefetch Ä‘Ă£ cháº¡y rá»“i â€” skip`);
      }

      // Kick pollPlayed chá»‰ Ä‘á»ƒ update UI sentencePlayed â€” auto-next Ä‘Ă£ xá»­ lĂ½ báº±ng onEnded
      setTimeout(pollPlayed, 200);
    }
  }, [selectedVoice, voices, getActx, schedulePCM, scheduleChunk, splitChunks, allChapters, slug, router, detectWorkerCount, prefetchNextChapter]);

  // â”€â”€ playFromPrefetchBuffer: play ngay chunks Ä‘Ă£ cĂ³, poll schedule chunks má»›i tá»« prefetch â”€â”€
  const playFromPrefetchBuffer = useCallback((chapter: Chapter) => {
    const chapIdx  = chapter.index;
    const isDone   = prefetchDoneRef.current;
    // Snapshot total NGAY Láº¬P Tá»¨C â€” trÆ°á»›c khi pollFromBuffer trigger prefetch chÆ°Æ¡ng tiáº¿p
    // vĂ  prefetchNextChapter ghi Ä‘Ă¨ prefetchTotalRef báº±ng total cá»§a chÆ°Æ¡ng sau
    const snapshotTotal = prefetchTotalRef.current;
    prefetchTotalRef.current = 0; // reset Ä‘á»ƒ chÆ°Æ¡ng tiáº¿p khĂ´ng Ä‘á»c nháº§m
    // KHĂ”NG snapshot buffer â€” Ä‘á»c trá»±c tiáº¿p prefetchedPCMRef Ä‘á»ƒ tháº¥y chunks má»›i
    console.log(`[W:PlayBuffer] START: "${chapter.title}" chunks cĂ³ sáºµn=${prefetchedPCMRef.current.length} prefetchDone=${isDone}`);

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
    // DĂ¹ng prefetchTotalRef náº¿u cĂ³ (biáº¿t ngay sau splitChunks trong prefetchNextChapter)
    // fallback vá» sá»‘ chunks Ä‘ang cĂ³ náº¿u chÆ°a cĂ³ total
    const knownTotal = snapshotTotal > 0 ? snapshotTotal : prefetchedPCMRef.current.length;
    if (knownTotal > 0) setSentenceTotal(knownTotal);

    const actx = getActx();

    // â”€â”€ handleBufferEnd: gá»i tá»« onEnded chunk cuá»‘i â€” hoáº¡t Ä‘á»™ng khi táº¯t mĂ n hĂ¬nh â”€â”€
    const handleBufferEnd = () => {
      if (audioHandledGlobalRef.current) return;
      if (activeChapIndexRef.current !== chapIdx) return;
      audioHandledGlobalRef.current = true;
      setSentencePlayed(generatedRef.current);
      setIsPlaying(false);
      setCompletedChapters(prev => new Set(prev).add(chapIdx));

      const sortedB  = [...allChapters].sort((a, b) => a.index - b.index);
      const nextMeta = sortedB.find(c => c.index > chapIdx);
      console.log(`[W:AutoNext] onEnded (buffer) â€” nextMeta=${nextMeta?.id ?? 'null'} prefetchDone=${prefetchDoneRef.current}`);
      if (!nextMeta) return;

      const hasPrefetch = prefetchedChapRef.current?.id === nextMeta.id &&
                          (prefetchDoneRef.current || prefetchingIdRef.current === nextMeta.id);
      if (hasPrefetch) {
        const nextChap = prefetchedChapRef.current!;
        setLoadedChapters(prev => ({ ...prev, [nextMeta.index]: nextChap }));
        setCurrentChapter(nextChap);
        router.replace(`/truyen/${slug}/nghe?chuong=${nextMeta.index}`, { scroll: false });
        playFromPrefetchBufferRef.current?.(nextChap);
      } else {
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
    };
    autoNextCallbackRef.current = handleBufferEnd;

    // â”€â”€ scheduleAvailable: schedule chunk Ä‘Ă£ cĂ³ + gáº¯n onEnded vĂ o chunk cuá»‘i â”€â”€
    // Schedule chunks Ä‘Ă£ cĂ³ ngay láº­p tá»©c
    let scheduledCount = 0;
    const scheduleAvailable = (isLastBatch = false) => {
      const allChunks = prefetchedPCMRef.current;
      const prevCount = scheduledCount;
      while (scheduledCount < allChunks.length && allChunks[scheduledCount] != null) {
        if (stopFlagRef.current) break;
        const item = allChunks[scheduledCount];
        const isLast = isLastBatch && scheduledCount === allChunks.length - 1;
        schedulePCM(actx, item.pcm, item.sampleRate, item.isClause, item.pauseMs,
          isLast ? () => autoNextCallbackRef.current?.() : undefined
        );
        endTimesRef.current.push(nextStartRef.current);
        generatedRef.current++;
        scheduledCount++;
      }
      if (scheduledCount > prevCount) setSentenceGenerated(generatedRef.current);
    };
    scheduleAvailable(isDone);
    console.log(`[W:PlayBuffer] Scheduled ${scheduledCount} chunks ngay`);

    if (isDone) {
      // Prefetch Ä‘Ă£ xong hoĂ n toĂ n â€” clear buffer, set pipelineDone
      prefetchedPCMRef.current  = [];
      prefetchDoneRef.current   = false;
      prefetchedChapRef.current = null;
      prefetchingIdRef.current  = null;
      pipelineDone.current      = true;
      setIsGenerating(false);
      setSentenceTotal(generatedRef.current);
      console.log(`[W:PlayBuffer] prefetchDone=true â€” pipelineDone=true total=${generatedRef.current}`);
    } else {
      // Prefetch chÆ°a xong â€” poll Ä‘á»ƒ schedule chunks má»›i khi prefetch generate thĂªm
      console.log(`[W:PlayBuffer] prefetchDone=false â€” poll schedule chunks má»›i`);

      // Trigger prefetch chÆ°Æ¡ng tiáº¿p ngay náº¿u chÆ°a cĂ³
      const triggerPrefetchNext = () => {
        if (pipelineDone.current && prefetchingIdRef.current === null && !prefetchDoneRef.current) {
          const sortedB  = [...allChapters].sort((a, b) => a.index - b.index);
          const nextMeta = sortedB.find(c => c.index > chapIdx);
          if (nextMeta) {
            console.log(`[W:Prefetch] Trigger tá»« playBuffer: id=${nextMeta.id}`);
            prefetchNextChapterRef.current?.(nextMeta);
          }
        }
      };

      const pollNewChunks = () => {
        if (stopFlagRef.current) { console.log('[W:PlayBuffer] pollNewChunks stopped'); return; }

        if (prefetchDoneRef.current) {
          // Prefetch xong â€” schedule pháº§n cĂ²n láº¡i vá»›i onEnded chunk cuá»‘i
          scheduleAvailable(true);
          prefetchedPCMRef.current  = [];
          prefetchDoneRef.current   = false;
          prefetchedChapRef.current = null;
          prefetchingIdRef.current  = null;
          pipelineDone.current      = true;
          setIsGenerating(false);
          setSentenceTotal(generatedRef.current);
          console.log(`[W:PlayBuffer] Prefetch Done â€” tá»•ng ${generatedRef.current} chunks, pipelineDone=true`);
          triggerPrefetchNext();
          return;
        }

        scheduleAvailable(false);
        console.log(`[W:PlayBuffer] pollNewChunks â€” scheduled=${scheduledCount} prefetchDone=${prefetchDoneRef.current}`);
        setTimeout(pollNewChunks, 100);
      };
      setTimeout(pollNewChunks, 100);
    }
  }, [getActx, schedulePCM, allChapters, slug, router]);

  // â”€â”€ Sync refs Ä‘á»ƒ trĂ¡nh circular dependency â”€â”€
  useEffect(() => {
    streamChapterRef.current          = streamChapter;
    playFromPrefetchBufferRef.current = playFromPrefetchBuffer;
    prefetchNextChapterRef.current    = prefetchNextChapter;
  }, [streamChapter, playFromPrefetchBuffer, prefetchNextChapter]);

  // â”€â”€ Play / Pause / Toggle â”€â”€
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
  const skip       = (_secs: number) => {}; // seek khĂ´ng support vá»›i sentence streaming

  // â”€â”€ goToChapter: chuyá»ƒn chÆ°Æ¡ng + phĂ¡t luĂ´n â”€â”€
  const goToChapter = useCallback(async (meta: ChapterMeta) => {
    if (meta.index === currentIdx) return;

    console.log(`[W:GoTo] chÆ°Æ¡ng ${meta.index} id=${meta.id} â€” prefetchingId=${prefetchingIdRef.current} prefetchChap=${prefetchedChapRef.current?.id ?? 'null'} prefetchDone=${prefetchDoneRef.current}`);

    // â”€â”€ Snapshot prefetch state TRÆ¯á»C stopAll â”€â”€
    // stopAll() sáº½ terminate workers + xĂ³a sáº¡ch táº¥t cáº£ prefetch refs
    // nĂªn pháº£i snapshot trÆ°á»›c Ä‘á»ƒ cĂ²n dĂ¹ng Ä‘Æ°á»£c sau
    const isPrefetching  = prefetchingIdRef.current === meta.id && !prefetchDoneRef.current;
    const isPrefetchDone = prefetchedChapRef.current?.id === meta.id && prefetchDoneRef.current;
    const hasPrefetch    = isPrefetchDone || isPrefetching;

    const snapshotChap   = hasPrefetch ? prefetchedChapRef.current : null;
    const snapshotPCM    = hasPrefetch ? [...prefetchedPCMRef.current] : [];
    const snapshotDone   = isPrefetchDone;

    // Stop audio hiá»‡n táº¡i + terminate workers + xĂ³a refs
    stopAll();

    setSentencePlayed(0);
    setSentenceGenerated(0);
    setSentenceTotal(snapshotPCM.length > 0 ? snapshotPCM.length : 0);

    if (hasPrefetch && snapshotChap) {
      console.log(`[W:GoTo] DĂ¹ng prefetch â€” done=${snapshotDone} chunks=${snapshotPCM.length}`);

      // Restore PCM buffer vĂ  metadata
      prefetchedChapRef.current = snapshotChap;
      prefetchedPCMRef.current  = snapshotPCM;
      prefetchDoneRef.current   = snapshotDone;
      prefetchStopRef.current   = false;

      if (!snapshotDone) {
        // Partial: cáº§n spawn láº¡i workers Ä‘á»ƒ generate tiáº¿p pháº§n cĂ²n thiáº¿u
        // prefetchNextChapter sáº½ detect prefetchedChapRef.id === meta.id
        // nhÆ°ng prefetchDone=false â†’ nĂ³ sáº½ reset vĂ  generate láº¡i tá»« Ä‘áº§u
        // nĂªn set prefetchingIdRef TRÆ¯á»C Ä‘á»ƒ nĂ³ skip reset, generate tiáº¿p tá»« chunk Ä‘Ă£ cĂ³
        prefetchingIdRef.current = meta.id;

        // Spawn workers má»›i (workers cÅ© Ä‘Ă£ bá»‹ terminate bá»Ÿi stopAll)
        const wCount = detectWorkerCount();
        const makeWorker = () => new Worker(`/workers/tts-worker.js?v=pcm1`, { type: 'module' });
        while (workerPoolRef.current.length < wCount) workerPoolRef.current.push(makeWorker());
        console.log(`[W:GoTo] Spawned ${workerPoolRef.current.length} workers má»›i Ä‘á»ƒ resume prefetch`);

        // Resume generate tá»« chunk tiáº¿p theo sau pháº§n Ä‘Ă£ cĂ³
        // prefetchNextChapterRef sáº½ generate vĂ  push vĂ o prefetchedPCMRef tá»« index snapshotPCM.length
        const resumeMeta = { id: snapshotChap.id, index: snapshotChap.index, title: snapshotChap.title };
        prefetchNextChapterRef.current?.(resumeMeta);
      } else {
        // Done: spawn workers sáºµn sĂ ng Ä‘á»ƒ prefetch chÆ°Æ¡ng tiáº¿p theo (ch+2)
        prefetchingIdRef.current = null;
        const wCount = detectWorkerCount();
        const makeWorker = () => new Worker(`/workers/tts-worker.js?v=pcm1`, { type: 'module' });
        while (workerPoolRef.current.length < wCount) workerPoolRef.current.push(makeWorker());
        console.log(`[W:GoTo] Spawned ${workerPoolRef.current.length} workers má»›i cho prefetch ch+2`);
      }

      setLoadedChapters(prev => ({ ...prev, [meta.index]: snapshotChap }));
      setCurrentChapter(snapshotChap);
      router.replace(`/truyen/${slug}/nghe?chuong=${meta.index}`, { scroll: false });
      playFromPrefetchBufferRef.current?.(snapshotChap);
    } else {
      // KhĂ´ng cĂ³ prefetch gĂ¬ â€” fetch + stream bĂ¬nh thÆ°á»ng
      console.log(`[W:GoTo] KhĂ´ng cĂ³ prefetch â€” fetch + stream`);

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

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // â”€â”€ Shared UI â”€â”€
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  // Debug panel â€” 4 Ă´ ngang, luĂ´n flex row
  const DebugPanel = (
    <div>
      {/* Progress bar 2 layer */}
      <div className="w-full h-2 bg-[#231f1a] rounded-full relative overflow-hidden">
        <div className="absolute inset-y-0 left-0 bg-green-500/40 rounded-full transition-all duration-500"
          style={{ width: sentenceTotal > 0 ? `${(sentenceGenerated / sentenceTotal) * 100}%` : '0%' }} />
        <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#e8580a] to-[#ff7c35] rounded-full transition-all duration-500"
          style={{ width: sentenceTotal > 0 ? `${(sentencePlayed / sentenceTotal) * 100}%` : '0%' }} />
      </div>
      {/* 4 Ă´ */}
      <div className="mt-2 flex gap-1.5">
        <div className="flex-1 flex flex-col items-center py-2 px-1 rounded-lg bg-[#e8580a]/10 border border-[#e8580a]/20 min-w-0">
          <span className="text-[20px] font-black text-[#ff7c35] leading-none">{sentencePlayed}</span>
          <span className="text-[8px] font-bold uppercase tracking-widest text-[#8a7e72] mt-1 whitespace-nowrap">â–¶ PhĂ¡t</span>
        </div>
        <div className="flex-1 flex flex-col items-center py-2 px-1 rounded-lg bg-green-900/20 border border-green-700/20 min-w-0">
          <span className="text-[20px] font-black text-green-400 leading-none">{sentenceGenerated}</span>
          <span className="text-[8px] font-bold uppercase tracking-widest text-[#8a7e72] mt-1 whitespace-nowrap">âœ“ Táº¡o</span>
        </div>
        <div className="flex-1 flex flex-col items-center py-2 px-1 rounded-lg bg-white/[0.04] border border-white/[0.06] min-w-0">
          <span className="text-[20px] font-black text-[#f0ebe4] leading-none">{sentenceTotal}</span>
          <span className="text-[8px] font-bold uppercase tracking-widest text-[#8a7e72] mt-1 whitespace-nowrap">âˆ‘ Tá»•ng</span>
        </div>
        <div className="flex-1 flex flex-col items-center py-2 px-1 rounded-lg bg-blue-900/20 border border-blue-700/20 min-w-0">
          <span className="text-[20px] font-black text-blue-400 leading-none">{ramMB ?? 'â€”'}</span>
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
          <span className="text-sm">đŸ™</span>
          <span className="text-[11px] font-bold text-[#f0ebe4] flex-1 text-left truncate">
            {voices.find(v => v.id === selectedVoice)?.name ?? 'Chá»n giá»ng'}
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
          className="px-2.5 py-2 text-[#e8580a] text-[13px] font-black hover:bg-[#e8580a]/15 transition-colors disabled:opacity-30">âˆ’</button>
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
            console.log(`[Worker] Pool resized â†’ ${workerPoolRef.current.length} workers`);
          }}
          disabled={workerCount <= 2}
          className="px-2.5 py-2 text-[#8a7e72] text-[13px] font-black hover:bg-white/[0.06] transition-colors disabled:opacity-30">âˆ’</button>
        <span className="text-[#8a7e72] text-[11px] font-black min-w-[32px] text-center">â¡{workerCount}</span>
        <button
          onClick={() => {
            const next = Math.min(4, workerCount + 1);
            setWorkerCount(next);
            const makeWorker = () => new Worker(`/workers/tts-worker.js?v=pcm1`, { type: 'module' });
            while (workerPoolRef.current.length < next) workerPoolRef.current.push(makeWorker());
            while (workerPoolRef.current.length > next) { try { workerPoolRef.current.pop()?.terminate(); } catch {} }
            console.log(`[Worker] Pool resized â†’ ${workerPoolRef.current.length} workers`);
          }}
          disabled={workerCount >= 4}
          className="px-2.5 py-2 text-[#8a7e72] text-[13px] font-black hover:bg-white/[0.06] transition-colors disabled:opacity-30">+</button>
      </div>
    </div>
  );

  // â”€â”€ Worker Panel UI â”€â”€
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
        <span className="text-[11px] font-black uppercase tracking-widest text-[#f0ebe4]">â¡ Luá»“ng Generate</span>
        <button onClick={() => setShowWorkerPanel(false)} className="text-[#8a7e72] hover:text-white text-[11px]">âœ•</button>
      </div>

      {/* HW info */}
      {hwInfo && (
        <div className="flex gap-2 text-[9px] text-[#8a7e72]">
          <span className="px-2 py-0.5 rounded-full bg-white/[0.05]">đŸ–¥ {hwInfo.cores} cores</span>
          <span className="px-2 py-0.5 rounded-full bg-white/[0.05]">đŸ’¾ {hwInfo.ram}GB RAM</span>
          <span className={`px-2 py-0.5 rounded-full ${hwInfo.isMT ? 'bg-green-900/40 text-green-400' : 'bg-yellow-900/40 text-yellow-400'}`}>
            {hwInfo.isMT ? 'âœ“ Multi-thread' : 'â  Single-thread'}
          </span>
        </div>
      )}

      {/* +/- buttons */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[#8a7e72]">Sá»‘ luá»“ng song song</span>
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
            className="w-7 h-7 rounded-lg bg-[#231f1a] border border-white/[0.07] text-white font-black text-sm disabled:opacity-30 hover:border-[#e8580a]/50 transition-colors">âˆ’</button>
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
        <p className="text-[9px] text-yellow-400/80">â  {workerCount} workers â‰ˆ {workerCount * 70}MB â€” cĂ³ thá»ƒ áº£nh hÆ°á»Ÿng hiá»‡u nÄƒng trĂªn mĂ¡y nĂ y</p>
      )}

      {hwInfo?.isMT && (
        <p className="text-[9px] text-green-400/70">âœ“ ONNX Ä‘ang cháº¡y multi-thread â€” 1 worker thÆ°á»ng Ä‘á»§ nhanh</p>
      )}
    </div>
  );

  // â”€â”€ Chapter row â”€â”€
  // useCallback + deps Ä‘Ăºng Ä‘á»ƒ khĂ´ng bá»‹ stale closure vá»›i currentIdx / completedChapters
  const renderChapRow = useCallback((chap: ChapterMeta) => {
    const isActive = chap.index === currentIdx;
    const isDone   = completedChapters.has(chap.index);
    return (
      <div
        key={chap.id}
        ref={isActive ? activeChapRef : undefined}
        onClick={() => {
          setShowChapterList(false);
          goToChapter(chap); // khĂ´ng await â€” trĂ¡nh block UI
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
          {isActive && <p className="text-[9px] text-[#8a7e72] mt-0.5">Äang nghe</p>}
        </div>
        {isActive
          ? <WaveIcon />
          : isDone
            ? <CheckCircle2 size={13} className="text-green-500 shrink-0" />
            : <div className="w-[13px]" />}
      </div>
    );
  }, [currentIdx, completedChapters, goToChapter]);

  // 4 chÆ°Æ¡ng preview quanh chapter hiá»‡n táº¡i (mobile)
  const previewChaps = (() => {
    const curPos = sortedChapters.findIndex(c => c.index === currentIdx);
    return sortedChapters.slice(curPos, curPos + 3);
  })();

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // â”€â”€ RENDER â”€â”€
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <div className="min-h-screen bg-[#0f0d0a] relative">
      {/* â”€â”€ Version Badge â”€â”€ */}
      <div className="fixed bottom-16 right-3 z-50 pointer-events-none">
        <div className="bg-[#1a1612]/90 border border-white/[0.07] rounded-lg px-2 py-1">
          <span className="text-[10px] font-black text-[#e8580a]">Android v1.0</span>
        </div>
      </div>

      {/* â”€â”€ Loading Overlay â”€â”€ */}
      {isGenerating && generatedRef.current === 0 && prefetchedPCMRef.current.length === 0 && (
        <LoadingOverlay
          chapterTitle={currentChapter.title || `ChÆ°Æ¡ng ${currentChapter.index}`}
          sentenceGenerated={sentenceGenerated}
          sentenceTotal={sentenceTotal}
        />
      )}

      {isIOS && (
        <div className="bg-amber-900/40 border-b border-amber-700/40 px-4 py-2 text-center">
          <p className="text-amber-300 text-xs font-medium">â ï¸ iOS: Giá»¯ mĂ n hĂ¬nh sĂ¡ng Ä‘á»ƒ nghe liĂªn tá»¥c</p>
        </div>
      )}

      {/* â”€â”€ Back + title overlay â”€â”€ */}
      <div className="absolute top-3 left-3 z-40 flex items-center gap-2">
        <Link href={`/truyen/${slug}`}
          className="w-8 h-8 rounded-lg bg-black/50 backdrop-blur-sm border border-white/[0.12] flex items-center justify-center text-[#8a7e72] hover:text-white transition-colors flex-shrink-0">
          <ArrowLeft size={15} />
        </Link>
        <div className="bg-black/50 backdrop-blur-sm border border-white/[0.08] rounded-lg px-3 py-1.5 max-w-[260px] min-w-0">
          <p className="text-[12px] font-bold text-[#f0ebe4] truncate leading-tight">{storyTitle}</p>
          <p className="text-[9px] text-[#8a7e72] leading-tight">Äang nghe Â· {author}</p>
        </div>
        <button onClick={() => setShowChapterList(true)}
          className="lg:hidden w-8 h-8 rounded-lg bg-black/50 backdrop-blur-sm border border-white/[0.12] flex items-center justify-center text-[#8a7e72] hover:text-white transition-colors">
          <List size={15} />
        </button>
      </div>

      {/* â•â•â•â• MOBILE (< lg) â€” full screen nhÆ° mockup â•â•â•â• */}
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

        {/* Controls cÄƒn bottom */}
        <div className="relative flex flex-col justify-end min-h-screen pb-7">
          <div className="mt-auto">
            <div className="px-6 pb-3">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[#e8580a]/50 bg-[#e8580a]/10 mb-2">
                <Headphones size={9} className="text-[#e8580a]" />
                <span className="text-[9px] font-black tracking-[.12em] uppercase text-[#e8580a]">ChÆ°Æ¡ng {currentIdx}</span>
              </div>
              <h1 className="font-serif text-[18px] font-bold text-[#f0ebe4] leading-tight mb-1">
                {currentChapter.title || `ChÆ°Æ¡ng ${currentIdx}`}
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
                <span className="text-[10px] font-black uppercase tracking-[.1em] text-[#f0ebe4]">Danh sĂ¡ch chÆ°Æ¡ng</span>
                <button onClick={() => setShowChapterList(true)}
                  className="bg-[#1a1612] border border-white/[0.07] rounded-lg px-2.5 py-1 text-[10px] font-bold text-[#e8580a]">
                  Xem táº¥t cáº£ â€º
                </button>
              </div>
              {previewChaps.map(renderChapRow)}
            </div>
          </div>
        </div>
      </div>

      {/* â•â•â•â• DESKTOP (â‰¥ lg) â€” 9/3 â•â•â•â• */}
      <div className="hidden lg:grid lg:grid-cols-12 h-screen">

        {/* LEFT 9 cols â€” cover full + controls cÄƒn bottom */}
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

          {/* Controls cÄƒn bottom */}
          <div className="absolute bottom-0 left-0 right-0 px-8 pb-8 flex flex-col gap-5">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[#e8580a]/50 bg-[#e8580a]/10 mb-2">
                <Headphones size={9} className="text-[#e8580a]" />
                <span className="text-[9px] font-black tracking-[.12em] uppercase text-[#e8580a]">ChÆ°Æ¡ng {currentIdx}</span>
              </div>
              <h1 className="font-serif text-[22px] font-bold text-[#f0ebe4] leading-tight mb-1">
                {currentChapter.title || `ChÆ°Æ¡ng ${currentIdx}`}
              </h1>
              <p className="text-[12px] text-[#8a7e72]">{author}</p>
            </div>
            {DebugPanel}
            {Controls}
            {VoiceSpeed}
            {WorkerPanel}
          </div>
        </div>

        {/* RIGHT 3 cols â€” infinite scroll chapter list */}
        <div className="col-span-3 flex flex-col bg-[#0d0b08] border-l border-white/[0.06] h-screen">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] flex-shrink-0">
            <span className="text-[10px] font-black uppercase tracking-[.12em] text-[#f0ebe4]">Danh sĂ¡ch chÆ°Æ¡ng</span>
            <span className="text-[10px] text-[#8a7e72]">{totalChapters} chÆ°Æ¡ng</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {sortedChapters.slice(0, desktopVisible).map(renderChapRow)}
            {(desktopVisible < sortedChapters.length || hasMoreChaps) && (
              <div ref={desktopSentinelRef} className="h-12 flex items-center justify-center">
                <span className="text-[10px] text-[#8a7e72] animate-pulse">Äang táº£i thĂªm...</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* â•â•â•â• MOBILE CHAPTER DRAWER â•â•â•â• */}
      {showChapterList && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col bg-[#0f0d0a]/96 backdrop-blur-sm">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.07] flex-shrink-0">
            <span className="text-[13px] font-black text-[#f0ebe4] uppercase tracking-[.08em]">Táº¥t cáº£ chÆ°Æ¡ng</span>
            <button onClick={() => setShowChapterList(false)}
              className="w-8 h-8 rounded-lg bg-white/[0.07] flex items-center justify-center text-[#8a7e72]">
              âœ•
            </button>
          </div>
          <div className="flex-1 overflow-y-auto" ref={chapListRef}>
            {sortedChapters.slice(0, mobileVisible).map(renderChapRow)}
            {(mobileVisible < sortedChapters.length || hasMoreChaps) && (
              <div ref={mobileSentinelRef} className="h-12 flex items-center justify-center">
                <span className="text-[10px] text-[#8a7e72] animate-pulse">Äang táº£i thĂªm...</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
