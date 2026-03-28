'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Headphones, SkipBack, SkipForward,
  Play, Pause, RotateCcw, RotateCw, ChevronDown,
  CheckCircle2, List, Info, MessageSquare, Star, Eye, BookOpen, Heart,
  Loader2, CornerDownRight, Trash2, X, Send, Bookmark, Trophy,
} from 'lucide-react';
import { toggleFollow, toggleLike, nominateStory, getStoryInteractions } from '@/actions/interactions';
import ReviewButton from '@/components/story/ReviewButton';

// ── R2 CDN base URL ──────────────────────────────────────────────────────
// Đổi URL này khi có custom domain, không cần sửa chỗ nào khác
const R2_BASE = 'https://pub-e24f7ec645fc49d79de9bf92a252cc29.r2.dev';

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
interface StoryReview {
  id: string;
  rating: number;
  content: string;
  createdAt: string;
  user: { name: string; image: string | null };
}

interface StoryInfo {
  id: string;
  description: string;
  status: string;
  genres: string[];
  ratingScore: number;
  ratingCount: number;
  viewCount: number;
  likeCount: number;
  followCount: number;
  nominationCount: number;
  reviews: StoryReview[];
}

interface CommentUser {
  id: string;
  name: string;
  image: string | null;
  role: string;
}

interface Comment {
  id: string;
  content: string;
  likeCount: number;
  isLiked: boolean;
  createdAt: string;
  user: CommentUser;
}

interface CurrentUser {
  id: string;
  name: string;
  image: string | null;
  role: string;
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
  storyInfo: StoryInfo;
  currentUser: CurrentUser | null;
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
function WaveIcon({ color = '#e8580a' }: { color?: string } = {}) {
  return (
    <div className="flex items-center gap-[2px] h-3 shrink-0" style={{ color }}>
      {[0, 150, 300, 450].map((delay, i) => (
        <span key={i} className="w-[2px] rounded-sm bg-current animate-bounce"
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
        {[20, 40, 55, 35, 50, 60, 45, 55, 30, 50, 40, 22].map((h, i) => (
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

type DrawerTab = 'chapters' | 'info' | 'comments';

// ─── Main ─────────────────────────────────────────────────
export default function ListeningClient({
  slug, storyId, storyTitle, storyCover, author,
  totalChapters, initialChapters, initialChapterIndex, initialChapter,
  storyInfo, currentUser,
}: Props) {
  const [allChapters, setAllChapters] = useState<ChapterMeta[]>(initialChapters);
  const chapPageRef = useRef<number>(1);
  const chapLoadingRef = useRef<boolean>(false);
  const noMoreChapsRef = useRef<boolean>(false);
  const hasMoreChaps = allChapters.length < totalChapters && !noMoreChapsRef.current;

  const loadMoreChapters = useCallback(async () => {
    if (chapLoadingRef.current || noMoreChapsRef.current || allChapters.length >= totalChapters) return;
    chapLoadingRef.current = true;
    const nextPage = chapPageRef.current + 1;
    try {
      const res = await fetch(`/api/chapters/toc?storyId=${storyId}&page=${nextPage}`);
      const json = await res.json();
      const newChaps: ChapterMeta[] = (json.data?.chapters ?? []).map((c: any) => ({
        id: c.id,
        index: c.index,
        title: c.title || `Chương ${c.index}`,
      }));
      if (newChaps.length > 0) {
        setAllChapters(prev => {
          const existingIds = new Set(prev.map(c => c.id));
          return [...prev, ...newChaps.filter(c => !existingIds.has(c.id))];
        });
        chapPageRef.current = nextPage;
      } else {
        // API hết data → dừng hẳn, không loop nữa
        noMoreChapsRef.current = true;
      }
    } catch (e) {
      console.error('[ChapterList] loadMore error', e);
    } finally {
      chapLoadingRef.current = false;
    }
  }, [storyId, allChapters.length, totalChapters]);
  const router = useRouter();

  // ── Audio engine refs ──
  const actxRef = useRef<AudioContext | null>(null);
  const nextStartRef = useRef<number>(0);
  const stopFlagRef = useRef<boolean>(false);
  const speedRef = useRef<number>(1);

  // ── Player state ──
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1.0);
  const [isGenerating, setIsGenerating] = useState(false);

  // ── Debug state ──
  const [sentencePlayed, setSentencePlayed] = useState(0);
  const [sentenceGenerated, setSentenceGenerated] = useState(0);
  const [sentenceTotal, setSentenceTotal] = useState(0);
  const [ramMB, setRamMB] = useState<number | null>(null);

  // ── Chapter state ──
  const [currentChapter, setCurrentChapter] = useState<Chapter>(initialChapter);
  const [loadedChapters, setLoadedChapters] = useState<Record<number, Chapter>>({
    [initialChapter.index]: initialChapter,
  });
  const [completedChapters, setCompletedChapters] = useState<Set<number>>(new Set());

  // ── Voice state ──
  const [voices, setVoices] = useState<{ id: string; name: string; path?: string }[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [showVoiceMenu, setShowVoiceMenu] = useState(false);

  // ── Worker settings ──
  const [showWorkerPanel, setShowWorkerPanel] = useState(false);
  const [workerCount, setWorkerCount] = useState(2); // mặc định 2
  const [hwInfo, setHwInfo] = useState<{ cores: number; ram: number; isMT: boolean } | null>(null);

  // ── Chapter list UI ──
  const [showChapterList, setShowChapterList] = useState(false);
  const [mobileVisible, setMobileVisible] = useState(PAGE_SIZE);
  const [desktopVisible, setDesktopVisible] = useState(PAGE_SIZE);
  const chapListRef = useRef<HTMLDivElement>(null);
  const activeChapRef = useRef<HTMLDivElement>(null);
  const mobileSentinelRef = useRef<HTMLDivElement>(null);
  const desktopSentinelRef = useRef<HTMLDivElement>(null);

  // ── Tab & Info/Comment UI ──
  const [desktopTab, setDesktopTab] = useState<DrawerTab>('chapters');
  const [mobileDrawer, setMobileDrawer] = useState<DrawerTab | null>(null);

  // ── Comments state ──
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentHasMore, setCommentHasMore] = useState(false);
  const [commentNextCursor, setCommentNextCursor] = useState<string | null>(null);
  const [commentLoading, setCommentLoading] = useState(false);
  const [commentLoadingMore, setCommentLoadingMore] = useState(false);
  const [commentLoaded, setCommentLoaded] = useState(false);
  const [commentInput, setCommentInput] = useState('');
  const [commentSending, setCommentSending] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const [commentPage, setCommentPage] = useState(1);
  const COMMENTS_PER_PAGE = 20;
  // ── Cooldown bình luận (sync backend 60s) ──
  const [commentCooldown, setCommentCooldown] = useState(0);
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // ── Credit toast (like / nominate / comment) ──
  const [creditToast, setCreditToast] = useState<string | null>(null);
  const creditToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [infoLoaded, setInfoLoaded] = useState(false);
  const [reviewPage, setReviewPage] = useState(1);
  const REVIEWS_PER_PAGE = 20;
  const [descExpanded, setDescExpanded] = useState(false);
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Interaction state (like / follow / nominate) ──
  const [interactStats, setInteractStats] = useState({
    likeCount: storyInfo.likeCount,
    followCount: storyInfo.followCount,
    nominationCount: storyInfo.nominationCount,
  });
  const [userStatus, setUserStatus] = useState({
    isLiked: false,
    isFollowed: false,
    isNominated: false,
  });
  const [interactLoading, setInteractLoading] = useState<'like' | 'follow' | 'nominate' | null>(null);
  // (interactLoading reserved for future use)

  // ── Fetch interaction status & stats mới nhất từ DB khi mount ──
  useEffect(() => {
    getStoryInteractions(storyId).then(({ stats, userStatus: us }) => {
      if (stats) {
        setInteractStats({
          likeCount: stats.likeCount,
          followCount: stats.followCount,
          nominationCount: stats.nominationCount,
        });
      }
      setUserStatus({
        isLiked: us.isLiked,
        isFollowed: us.isFollowed,
        isNominated: false, // nominations là 1 chiều, không toggle
      });
    });
  }, [storyId]);


  const currentIdx = currentChapter.index;
  const sortedChapters = [...allChapters].sort((a, b) => a.index - b.index);
  const hasPrev = sortedChapters.some(c => c.index < currentIdx);
  const hasNext = sortedChapters.some(c => c.index > currentIdx);

  // ── Detect hardware info khi mount ──
  useEffect(() => {
    const cores = navigator.hardwareConcurrency ?? 2;
    const ram = (navigator as any).deviceMemory ?? 4;
    const isMT = typeof self !== 'undefined' && (self as any).crossOriginIsolated === true;
    const maxByRam = Math.max(1, Math.floor((ram * 1024 * 0.3) / 70));
    const maxByCore = Math.max(1, Math.floor(cores / 2));
    const autoMax = Math.min(maxByRam, maxByCore, 4);
    setHwInfo({ cores, ram, isMT });
    // Auto set về max nếu mặc định 2 vượt quá giới hạn
    setWorkerCount(w => Math.max(2, Math.min(w, Math.max(2, autoMax))));
  }, []);

  // ── Load voice manifest ──
  useEffect(() => {
    fetch(`${R2_BASE}/models/custom/manifest.json`)
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
    navigator.mediaSession.setActionHandler('nexttrack', () => goChapter('next'));
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
      if (entries[0].isIntersecting) {
        setMobileVisible(prev => Math.min(prev + PAGE_SIZE, sortedChapters.length));
        loadMoreChapters();
      }
    }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [showChapterList, sortedChapters.length, loadMoreChapters]);

  // ── IntersectionObserver: desktop panel ──
  useEffect(() => {
    if (desktopTab !== 'chapters') return; // sentinel chỉ tồn tại khi tab chapters active
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
  }, [desktopTab, sortedChapters.length, loadMoreChapters]);

  // ── Fetch comments (lazy: chỉ khi user mở tab lần đầu) ──
  const fetchComments = useCallback(async () => {
    setCommentLoading(true);
    try {
      const res = await fetch(`/api/stories/${slug}/comments?limit=20`);
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setComments(json.data);
          setCommentHasMore(json.hasMore ?? false);
          setCommentNextCursor(json.nextCursor ?? null);
          setCommentLoaded(true);
          setCommentPage(1);
        }
      }
    } catch (e) { console.error(e); }
    finally { setCommentLoading(false); }
  }, [slug]);

  // ── Load more older comments ──
  const handleLoadMoreComments = useCallback(async () => {
    if (!commentHasMore || commentLoadingMore || !commentNextCursor) return;
    setCommentLoadingMore(true);
    try {
      const res = await fetch(`/api/stories/${slug}/comments?limit=20&after=${commentNextCursor}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setComments(prev => [...json.data, ...prev]);
          setCommentHasMore(json.hasMore ?? false);
          setCommentNextCursor(json.nextCursor ?? null);
        }
      }
    } catch (e) { console.error(e); }
    finally { setCommentLoadingMore(false); }
  }, [slug, commentHasMore, commentLoadingMore, commentNextCursor]);

  // ── Like comment (optimistic) ──
  const handleLikeComment = useCallback(async (commentId: string) => {
    if (!currentUser) { window.location.href = '/login?callbackUrl=' + window.location.pathname; return; }
    // Optimistic
    setComments(prev => prev.map(c =>
      c.id === commentId
        ? { ...c, isLiked: !c.isLiked, likeCount: c.isLiked ? c.likeCount - 1 : c.likeCount + 1 }
        : c
    ));
    try {
      const res = await fetch(`/api/stories/${slug}/comments/${commentId}/like`, { method: 'POST' });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setComments(prev => prev.map(c =>
            c.id === commentId ? { ...c, isLiked: json.data.isLiked, likeCount: json.data.likeCount } : c
          ));
        }
      } else {
        // Rollback
        setComments(prev => prev.map(c =>
          c.id === commentId
            ? { ...c, isLiked: !c.isLiked, likeCount: c.isLiked ? c.likeCount - 1 : c.likeCount + 1 }
            : c
        ));
      }
    } catch {
      setComments(prev => prev.map(c =>
        c.id === commentId
          ? { ...c, isLiked: !c.isLiked, likeCount: c.isLiked ? c.likeCount - 1 : c.likeCount + 1 }
          : c
      ));
    }
  }, [slug, currentUser]);

  // ── Reply ──
  const handleReplyComment = useCallback((comment: Comment) => {
    if (!currentUser) { window.location.href = '/login?callbackUrl=' + window.location.pathname; return; }
    setReplyTo({ id: comment.id, name: comment.user.name });
    setCommentInput('');
    setTimeout(() => {
      commentTextareaRef.current?.focus();
      commentTextareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  }, [currentUser]);

  // ── Delete comment ──
  const handleDeleteComment = useCallback(async (commentId: string) => {
    if (!confirm('Bạn có chắc muốn xóa bình luận này?')) return;
    try {
      const res = await fetch(`/api/stories/${slug}/comments/${commentId}`, { method: 'DELETE' });
      if (res.ok) {
        setComments(prev => prev.filter(c => c.id !== commentId));
      } else {
        const err = await res.json();
        alert(err.error || 'Xóa thất bại');
      }
    } catch { alert('Lỗi kết nối'); }
  }, [slug]);

  // ── checkAuth ──
  const checkAuth = useCallback(() => {
    if (!currentUser) {
      if (confirm('Bạn cần đăng nhập để thực hiện chức năng này. Đăng nhập ngay?')) {
        router.push('/login?callbackUrl=' + window.location.pathname);
      }
      return false;
    }
    return true;
  }, [currentUser, router]);

  // ── Credit toast helper ──
  const showCreditToast = useCallback((msg: string) => {
    setCreditToast(msg);
    if (creditToastTimerRef.current) clearTimeout(creditToastTimerRef.current);
    creditToastTimerRef.current = setTimeout(() => setCreditToast(null), 4000);
  }, []);

  // ── Cooldown timer helper ──
  const startCooldown = useCallback((seconds: number) => {
    if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    setCommentCooldown(seconds);
    cooldownTimerRef.current = setInterval(() => {
      setCommentCooldown(prev => {
        if (prev <= 1) { clearInterval(cooldownTimerRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // ── Cleanup timers on unmount ──
  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
      if (creditToastTimerRef.current) clearTimeout(creditToastTimerRef.current);
    };
  }, []);

  // ── Like handler ──
  const handleLike = useCallback(async () => {
    if (!checkAuth()) return;
    const newLiked = !userStatus.isLiked;
    setUserStatus(s => ({ ...s, isLiked: newLiked }));
    setInteractStats(s => ({ ...s, likeCount: s.likeCount + (newLiked ? 1 : -1) }));
    const res = await toggleLike(storyId);
    if (res.error) {
      setUserStatus(s => ({ ...s, isLiked: !newLiked }));
      setInteractStats(s => ({ ...s, likeCount: s.likeCount + (newLiked ? -1 : 1) }));
      alert(res.error);
    } else if (newLiked && res.creditMessage) {
      showCreditToast(res.creditMessage);
    }
  }, [checkAuth, userStatus.isLiked, storyId, showCreditToast]);

  // ── Follow handler ──
  const handleFollow = useCallback(async () => {
    if (!checkAuth()) return;
    const newFollowed = !userStatus.isFollowed;
    setUserStatus(s => ({ ...s, isFollowed: newFollowed }));
    setInteractStats(s => ({ ...s, followCount: s.followCount + (newFollowed ? 1 : -1) }));
    const res = await toggleFollow(storyId);
    if (res.error) {
      setUserStatus(s => ({ ...s, isFollowed: !newFollowed }));
      setInteractStats(s => ({ ...s, followCount: s.followCount + (newFollowed ? -1 : 1) }));
      alert(res.error);
    }
  }, [checkAuth, userStatus.isFollowed, storyId]);

  // ── Nominate handler ──
  const handleNominate = useCallback(async () => {
    if (!checkAuth()) return;
    // Optimistic: tăng count trước
    setInteractStats(s => ({ ...s, nominationCount: s.nominationCount + 1 }));
    const res = await nominateStory(storyId);
    if (res.error) {
      // Lỗi hệ thống — rollback
      setInteractStats(s => ({ ...s, nominationCount: s.nominationCount - 1 }));
      alert(res.error);
    } else if (res.success === false) {
      // Đã đề cử hôm nay hoặc bị block — rollback, chỉ toast thông báo
      setInteractStats(s => ({ ...s, nominationCount: s.nominationCount - 1 }));
      if (res.creditMessage) showCreditToast(res.creditMessage);
    } else if (res.creditMessage) {
      // Đề cử thành công
      showCreditToast(res.creditMessage);
    }
  }, [checkAuth, storyId, showCreditToast]);

  // ── Gửi comment ──
  const handleSendComment = useCallback(async () => {
    if (!commentInput.trim() || commentSending || commentCooldown > 0) return;
    if (!currentUser) { window.location.href = '/login?callbackUrl=' + window.location.pathname; return; }
    const body = replyTo ? `@${replyTo.name} ${commentInput.trim()}` : commentInput.trim();
    setCommentSending(true);
    try {
      const res = await fetch(`/api/stories/${slug}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: body }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setComments(prev => [...prev, json.data]);
          setCommentInput('');
          setReplyTo(null);
          commentTextareaRef.current?.focus();
          // Toast credit
          if (json.creditMessage) showCreditToast(json.creditMessage);
          // Cooldown: dùng giá trị server trả về, fallback 60s
          startCooldown(json.cooldownSeconds && json.cooldownSeconds > 0 ? json.cooldownSeconds : 60);
        }
      } else {
        const err = await res.json();
        alert(err.error || 'Gửi thất bại');
      }
    } catch { alert('Lỗi kết nối'); }
    finally { setCommentSending(false); }
  }, [commentInput, commentSending, commentCooldown, slug, replyTo, currentUser, showCreditToast, startCooldown]);

  // ── Khi user mở tab info/comments lần đầu ──
  const handleOpenTab = useCallback((tab: DrawerTab) => {
    if (tab === 'comments' && !commentLoaded) {
      fetchComments();
    }
    if (tab === 'info') { setInfoLoaded(true); setReviewPage(1); }
  }, [commentLoaded, fetchComments]);

  // ── Desktop tab switch ──
  const handleDesktopTab = useCallback((tab: DrawerTab) => {
    setDesktopTab(tab);
    handleOpenTab(tab);
  }, [handleOpenTab]);

  // ── Mobile drawer open ──
  const handleMobileDrawer = useCallback((tab: DrawerTab) => {
    setMobileDrawer(tab);
    handleOpenTab(tab);
  }, [handleOpenTab]);



  // ── Format thời gian comment ──
  const timeAgo = (dateStr: string) => {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return 'Vừa xong';
    if (diff < 3600) return Math.floor(diff / 60) + ' phút trước';
    if (diff < 86400) return Math.floor(diff / 3600) + ' giờ trước';
    if (diff < 2592000) return Math.floor(diff / 86400) + ' ngày trước';
    return new Date(dateStr).toLocaleDateString('vi-VN');
  };

  const statusLabel = (s: string) => {
    if (s === 'COMPLETED') return 'Hoàn thành';
    if (s === 'TRANSLATED') return 'Dịch';
    if (s === 'CONVERTED') return 'Convert';
    return 'Đang ra';
  };

  // Avatar với gradient
  const avatarColors = [
    'linear-gradient(135deg,#E8580A,#F5A623)',
    'linear-gradient(135deg,#667eea,#764ba2)',
    'linear-gradient(135deg,#f093fb,#f5576c)',
    'linear-gradient(135deg,#4facfe,#00f2fe)',
    'linear-gradient(135deg,#43e97b,#38f9d7)',
  ];
  const getAvatar = (name: string, image: string | null, size = 28) => {
    const bg = avatarColors[name.charCodeAt(0) % avatarColors.length];
    if (image) return <img src={image} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />;
    return (
      <div style={{ width: size, height: size, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: size * 0.38, fontWeight: 900, color: '#fff' }}>
        {name.charAt(0).toUpperCase()}
      </div>
    );
  };

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
      try { w?.terminate(); } catch { }
    }
    workerPoolRef.current = [];
    piperRef.current = null;
    // Dọn prefetch state — tránh rác khi chuyển chương bất ngờ
    prefetchedPCMRef.current = [];
    prefetchDoneRef.current = false;
    prefetchedChapRef.current = null;
    prefetchingIdRef.current = null;
    prefetchStopRef.current = true;
    prefetchTotalRef.current = 0;
  }, []);

  // trimSilence: cắt bỏ silence ở đầu/cuối PCM
  // threshold: sample phải vượt mức này mới tính là "có âm thanh"
  // margin: giữ lại vài ms để tránh click artifact
  const trimSilence = useCallback((pcm: Float32Array, sampleRate: number, thresholdDb = -45): Float32Array => {
    const threshold = Math.pow(10, thresholdDb / 20); // -45dB ≈ 0.006
    const marginSamples = Math.floor(sampleRate * 0.003); // 3ms margin
    let start = 0;
    let end = pcm.length - 1;
    while (start < pcm.length && Math.abs(pcm[start]) < threshold) start++;
    while (end > start && Math.abs(pcm[end]) < threshold) end--;
    start = Math.max(0, start - marginSamples);
    end = Math.min(pcm.length - 1, end + marginSamples);
    const trimmedMs = ((pcm.length - (end - start + 1)) / sampleRate * 1000).toFixed(0);
    if (Number(trimmedMs) > 50) console.log(`[Trim] removed=${trimmedMs}ms original=${(pcm.length / sampleRate * 1000).toFixed(0)}ms`);
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

      const s = speedRef.current;
      const startAt = Math.max(actx.currentTime, nextStartRef.current);

      // Fade-in 10ms đầu chunk + fade-out 10ms cuối chunk — giảm click/pop
      const endAt = startAt + audioBuffer.duration / s;
      const gainNode = actx.createGain();
      gainNode.connect(actx.destination);
      // Fade-in: luôn apply để tránh click khi chunk bắt đầu
      gainNode.gain.setValueAtTime(0, startAt);
      gainNode.gain.linearRampToValueAtTime(1, startAt + 0.01); // 10ms fade in
      // Fade-out: 10ms trước khi chunk kết thúc
      gainNode.gain.setValueAtTime(1, Math.max(startAt + 0.01, endAt - 0.01));
      gainNode.gain.linearRampToValueAtTime(0, endAt);

      const source = actx.createBufferSource();
      source.buffer = audioBuffer;
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
      const s = speedRef.current;
      const source = actx.createBufferSource();
      source.buffer = audioBuffer;
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
  const endTimesRef = useRef<number[]>([]);
  const generatedRef = useRef<number>(0);
  const pipelineDone = useRef<boolean>(false);
  const audioHandledGlobalRef = useRef<boolean>(false); // guard chung cho pollPlayed + pollFromBuffer — tránh double auto-next
  const activeChapIndexRef = useRef<number>(-1);     // index chương đang active — pollPlayed/pollFromBuffer stale tự dừng
  const streamChapterRef = useRef<((ch: Chapter) => Promise<void>) | null>(null);
  const playFromPrefetchBufferRef = useRef<((ch: Chapter) => void) | null>(null);
  const piperRef = useRef<any>(null); // giữ worker sống → không load lại model mỗi chương
  const workerPoolRef = useRef<any[]>([]);  // pool nhiều worker theo phần cứng
  const workerCountRef = useRef<number>(1);  // số worker thực tế dùng

  const BUFFER_AHEAD = 4;

  // ── Prefetch chương tiếp theo ──
  const prefetchedChapRef = useRef<Chapter | null>(null);      // chapter metadata
  const prefetchedPCMRef = useRef<Array<{ pcm: Float32Array; sampleRate: number; isClause: boolean; pauseMs: number }>>([]);
  const prefetchDoneRef = useRef<boolean>(false);
  const prefetchingIdRef = useRef<string | null>(null);
  const prefetchNextChapterRef = useRef<((meta: { id: string; index: number; title: string }) => void) | null>(null);
  const prefetchStopRef = useRef<boolean>(false);
  const prefetchTotalRef = useRef<number>(0);  // tổng chunks của chương đang prefetch — biết ngay sau splitChunks

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
        const isLastPara = pi === paragraphs.length - 1;
        const hasEllipsis = /\.{3}|…/.test(sent);
        const hasDash = /[\u2014\u2013]/.test(sent);

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
          const p = validParts[k];
          const isClause = k < validParts.length - 1;
          const nextText = k + 1 < validParts.length ? validParts[k + 1] : '';
          const isBeforeConnector = CONNECTORS.test(nextText.trimStart());
          const partHasDash = /[\u2014\u2013]/.test(p);
          const partHasEllipsis = /\.{3}|…/.test(p);

          let pauseMs: number;
          if (!isClause) {
            if (isLastSentenceInPara && !isLastPara) pauseMs = 640;
            else if (partHasEllipsis || partHasDash) pauseMs = 288;
            else pauseMs = 400;
          } else {
            if (isBeforeConnector) pauseMs = 320;
            else if (countWords(p) > 10) pauseMs = 240;
            else if (partHasDash || partHasEllipsis) pauseMs = 288;
            else pauseMs = 192;
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
      prefetchStopRef.current = false;
      prefetchedPCMRef.current = [];
      prefetchDoneRef.current = false;
      prefetchedChapRef.current = null;

      // Fetch content
      console.log(`[W:Prefetch] Fetching content: /api/chapters/${nextMeta.id}`);
      const res = await fetch(`/api/chapters/${nextMeta.id}`).then(r => r.json());
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
      modelUrl: `${modelBase}.onnx`,
      modelConfigUrl: `${modelBase}.onnx.json`,
      onnxruntimeUrl: `${R2_BASE}/piper-wasm`,
      piperPhonemizeJsUrl: `${R2_BASE}/piper-wasm/piper_phonemize.js`,
      piperPhonemizeWasmUrl: `${R2_BASE}/piper-wasm/piper_phonemize.wasm`,
      piperPhonemizeDataUrl: `${R2_BASE}/piper-wasm/piper_phonemize.data`,
      blobs: {},
    };

    const text = stripHtml((chap.title ? `Chương ${chap.index}. ${cleanTitle(chap.title, chap.index)}. ` : '') + chap.content);
    const chunks = splitChunks(text);
    const total = chunks.length;
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
        }).catch(() => { });
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
              console.log(`[Prefetch:W${wIdx}] chunk ${i}/${total - 1} done`);
            }
          } catch { continue; }
        }
      })();
    });

    await Promise.allSettled([phonemizeAll, ...consumers]);

    if (!prefetchStopRef.current) {
      prefetchedPCMRef.current = pcmBuffer.filter(Boolean) as typeof prefetchedPCMRef.current;
      prefetchDoneRef.current = true;
      console.log(`[W:Prefetch] Done: ${chap.title} id=${chap.id} — ${prefetchedPCMRef.current.length} chunks`);
    }
  }, [voices, selectedVoice, splitChunks]);

  const streamChapter = useCallback(async (chapter: Chapter) => {
    console.log(`[W:Stream] streamChapter called: ${chapter.title} selectedVoice=${selectedVoice}`);
    if (!selectedVoice) { console.log('[W:Stream] ABORT: no selectedVoice'); return; }

    stopFlagRef.current = false;
    pipelineDone.current = false;
    endTimesRef.current = [];
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
      try { workerPoolRef.current.pop()?.terminate(); } catch { }
    }
    console.log(`[TTS] Worker pool: ${workerPoolRef.current.length} workers — phonemize=worker[0], infer=worker[1..${workerPoolRef.current.length - 1}]`);
    console.log(`[TTS] Chapter: ${chapter.title} — chunks will be split from text`);

    const voiceMeta = voices.find(v => v.id === selectedVoice);
    const modelBase = `${R2_BASE}/models/custom/${voiceMeta?.path ?? selectedVoice}`;
    const workerBase = {
      modelUrl: `${modelBase}.onnx`,
      modelConfigUrl: `${modelBase}.onnx.json`,
      onnxruntimeUrl: `${R2_BASE}/piper-wasm`,
      piperPhonemizeJsUrl: `${R2_BASE}/piper-wasm/piper_phonemize.js`,
      piperPhonemizeWasmUrl: `${R2_BASE}/piper-wasm/piper_phonemize.wasm`,
      piperPhonemizeDataUrl: `${R2_BASE}/piper-wasm/piper_phonemize.data`,
      blobs: {},
    };

    const text = stripHtml((chapter.title ? chapter.title + '. ' : '') + chapter.content);
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
      const audioEmpty = pipelineDone.current && lastEndTime > 0 && now >= lastEndTime - 0.3;
      if (audioEmpty) {
        if (audioHandledGlobalRef.current) return; // đã bị cái khác xử lý rồi
        audioHandledGlobalRef.current = true; // claim ngay — atomic trong JS single-thread
        setSentencePlayed(generatedRef.current);
        setIsPlaying(false);
        setCompletedChapters(prev => new Set(prev).add(chapIndex));

        // Auto next — dùng prefetch buffer nếu có, không fetch lại
        const sorted2 = [...allChapters].sort((a, b) => a.index - b.index);
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

      const pool = workerPoolRef.current;
      const total = chunks.length;

      const slotReady: Array<() => void> = new Array(total);
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
            console.log(`[Worker:${wIdx}] chunk ${i}/${total - 1} infer done — generated=${generatedRef.current}`);
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
      const sortedP = [...allChapters].sort((a, b) => a.index - b.index);
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
    const chapIdx = chapter.index;
    const isDone = prefetchDoneRef.current;
    // Snapshot total NGAY LẬP TỨC — trước khi pollFromBuffer trigger prefetch chương tiếp
    // và prefetchNextChapter ghi đè prefetchTotalRef bằng total của chương sau
    const snapshotTotal = prefetchTotalRef.current;
    prefetchTotalRef.current = 0; // reset để chương tiếp không đọc nhầm
    // KHÔNG snapshot buffer — đọc trực tiếp prefetchedPCMRef để thấy chunks mới
    console.log(`[W:PlayBuffer] START: "${chapter.title}" chunks có sẵn=${prefetchedPCMRef.current.length} prefetchDone=${isDone}`);

    stopFlagRef.current = false;
    pipelineDone.current = false;
    endTimesRef.current = [];
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
      while (scheduledCount < allChunks.length && allChunks[scheduledCount] != null) {
        if (stopFlagRef.current) break;
        const item = allChunks[scheduledCount];
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
      prefetchedPCMRef.current = [];
      prefetchDoneRef.current = false;
      prefetchedChapRef.current = null;
      prefetchingIdRef.current = null;
      pipelineDone.current = true;
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
          const item = allChunks[scheduledCount];
          const endTime = schedulePCM(actx, item.pcm, item.sampleRate, item.isClause, item.pauseMs);
          endTimesRef.current.push(endTime);
          generatedRef.current++;
          scheduledCount++;
        }
        setSentenceGenerated(generatedRef.current);
        console.log(`[W:PlayBuffer] pollNewChunks — scheduled=${scheduledCount} prefetchDone=${prefetchDoneRef.current}`);

        if (prefetchDoneRef.current) {
          // Prefetch xong — clear buffer, set pipelineDone
          prefetchedPCMRef.current = [];
          prefetchDoneRef.current = false;
          prefetchedChapRef.current = null;
          prefetchingIdRef.current = null;
          pipelineDone.current = true;
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
      const now = actxNow.currentTime;
      const played = endTimesRef.current.filter(t => t <= now).length;
      setSentencePlayed(played);

      // Trigger prefetch chương tiếp khi pipelineDone
      if (pipelineDone.current && prefetchingIdRef.current === null && !prefetchDoneRef.current) {
        const sortedB = [...allChapters].sort((a, b) => a.index - b.index);
        const nextMeta = sortedB.find(c => c.index > chapIdx);
        if (nextMeta) {
          console.log(`[W:Prefetch] Trigger từ pollFromBuffer: id=${nextMeta.id}`);
          prefetchNextChapterRef.current?.(nextMeta);
        }
      }

      const lastEndTime = endTimesRef.current[endTimesRef.current.length - 1] ?? 0;
      const audioEmpty = pipelineDone.current && lastEndTime > 0 && now >= lastEndTime - 0.3;
      if (audioEmpty) {
        if (audioHandledGlobalRef.current) return; // đã bị pollPlayed xử lý rồi
        audioHandledGlobalRef.current = true; // claim ngay
        setSentencePlayed(generatedRef.current);
        setIsPlaying(false);
        setCompletedChapters(prev => new Set(prev).add(chapIdx));

        const sortedB = [...allChapters].sort((a, b) => a.index - b.index);
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
    streamChapterRef.current = streamChapter;
    playFromPrefetchBufferRef.current = playFromPrefetchBuffer;
    prefetchNextChapterRef.current = prefetchNextChapter;
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
  const skip = (_secs: number) => { }; // seek không support với sentence streaming

  // ── goToChapter: chuyển chương + phát luôn ──
  const goToChapter = useCallback(async (meta: ChapterMeta) => {
    if (meta.index === currentIdx) return;

    console.log(`[W:GoTo] chương ${meta.index} id=${meta.id} — prefetchingId=${prefetchingIdRef.current} prefetchChap=${prefetchedChapRef.current?.id ?? 'null'} prefetchDone=${prefetchDoneRef.current}`);

    // ── Snapshot prefetch state TRƯỚC stopAll ──
    // stopAll() sẽ terminate workers + xóa sạch tất cả prefetch refs
    // nên phải snapshot trước để còn dùng được sau
    const isPrefetching = prefetchingIdRef.current === meta.id && !prefetchDoneRef.current;
    const isPrefetchDone = prefetchedChapRef.current?.id === meta.id && prefetchDoneRef.current;
    const hasPrefetch = isPrefetchDone || isPrefetching;

    const snapshotChap = hasPrefetch ? prefetchedChapRef.current : null;
    const snapshotPCM = hasPrefetch ? [...prefetchedPCMRef.current] : [];
    const snapshotDone = isPrefetchDone;

    // Stop audio hiện tại + terminate workers + xóa refs
    stopAll();

    setSentencePlayed(0);
    setSentenceGenerated(0);
    setSentenceTotal(snapshotPCM.length > 0 ? snapshotPCM.length : 0);

    if (hasPrefetch && snapshotChap) {
      console.log(`[W:GoTo] Dùng prefetch — done=${snapshotDone} chunks=${snapshotPCM.length}`);

      // Restore PCM buffer và metadata
      prefetchedChapRef.current = snapshotChap;
      prefetchedPCMRef.current = snapshotPCM;
      prefetchDoneRef.current = snapshotDone;
      prefetchStopRef.current = false;

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
        const res = await fetch(`/api/chapters/${meta.id}`);
        const json = await res.json();
        chap = json.data ?? json;
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
        className="w-9 h-9 rounded-full bg-[#2a2520] border border-white/[0.20] flex items-center justify-center text-white disabled:opacity-30 hover:border-white/40 transition-colors">
        <SkipBack size={16} />
      </button>
      <button onClick={() => skip(-15)}
        className="w-9 h-9 rounded-full bg-[#2a2520] border border-white/[0.20] flex items-center justify-center text-white hover:border-white/40 transition-colors">
        <RotateCcw size={15} />
      </button>
      <button onClick={togglePlay} disabled={isGenerating && generatedRef.current === 0}
        className="w-14 h-14 rounded-full bg-gradient-to-br from-[#e8580a] to-[#ff7c35] flex items-center justify-center text-white shadow-[0_4px_20px_rgba(232,88,10,0.5)] hover:shadow-[0_6px_28px_rgba(232,88,10,0.65)] transition-all active:scale-95 disabled:opacity-60">
        {isPlaying
          ? <Pause size={22} fill="white" />
          : <Play size={22} fill="white" className="translate-x-0.5" />}
      </button>
      <button onClick={() => skip(15)}
        className="w-9 h-9 rounded-full bg-[#2a2520] border border-white/[0.20] flex items-center justify-center text-white hover:border-white/40 transition-colors">
        <RotateCw size={15} />
      </button>
      <button onClick={() => goChapter('next')} disabled={!hasNext}
        className="w-9 h-9 rounded-full bg-[#2a2520] border border-white/[0.20] flex items-center justify-center text-white disabled:opacity-30 hover:border-white/40 transition-colors">
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
          <span className="text-[12px] font-bold text-white flex-1 text-left truncate">
            {voices.find(v => v.id === selectedVoice)?.name ?? 'Chọn giọng'}
          </span>
          <ChevronDown size={12} className="text-[#c0b4a8]" />
        </button>
        {showVoiceMenu && voices.length > 0 && (
          <div className="absolute bottom-full left-0 right-0 mb-1 bg-[#1a1612] border border-white/[0.09] rounded-xl overflow-hidden shadow-xl z-20 max-h-48 overflow-y-auto">
            {voices.map(v => (
              <button key={v.id} onClick={() => { setSelectedVoice(v.id); setShowVoiceMenu(false); }}
                className={`w-full text-left px-3 py-2.5 text-[11px] font-medium transition-colors ${v.id === selectedVoice ? 'bg-[#e8580a]/15 text-[#ff7c35]' : 'text-[#f0ebe4] hover:bg-white/[0.05]'
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
            while (workerPoolRef.current.length > next) { try { workerPoolRef.current.pop()?.terminate(); } catch { } }
            console.log(`[Worker] Pool resized → ${workerPoolRef.current.length} workers`);
          }}
          disabled={workerCount <= 2}
          className="px-2.5 py-2 text-[#c0b4a8] text-[13px] font-black hover:bg-white/[0.06] transition-colors disabled:opacity-30">−</button>
        <span className="text-[#c0b4a8] text-[11px] font-black min-w-[32px] text-center">⚡{workerCount}</span>
        <button
          onClick={() => {
            const next = Math.min(4, workerCount + 1);
            setWorkerCount(next);
            const makeWorker = () => new Worker(`/workers/tts-worker.js?v=pcm1`, { type: 'module' });
            while (workerPoolRef.current.length < next) workerPoolRef.current.push(makeWorker());
            while (workerPoolRef.current.length > next) { try { workerPoolRef.current.pop()?.terminate(); } catch { } }
            console.log(`[Worker] Pool resized → ${workerPoolRef.current.length} workers`);
          }}
          disabled={workerCount >= 4}
          className="px-2.5 py-2 text-[#c0b4a8] text-[13px] font-black hover:bg-white/[0.06] transition-colors disabled:opacity-30">+</button>
      </div>
    </div>
  );

  // ── Worker Panel UI ──
  const maxWorker = (() => {
    if (!hwInfo) return 4;
    const maxByRam = Math.max(1, Math.floor((hwInfo.ram * 1024 * 0.3) / 70));
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
              while (workerPoolRef.current.length > next) { try { workerPoolRef.current.pop()?.terminate(); } catch { } }
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
              while (workerPoolRef.current.length > next) { try { workerPoolRef.current.pop()?.terminate(); } catch { } }
            }}
            disabled={workerCount >= maxWorker}
            className="w-7 h-7 rounded-lg bg-[#231f1a] border border-white/[0.07] text-white font-black text-sm disabled:opacity-30 hover:border-[#e8580a]/50 transition-colors">+</button>
        </div>
      </div>

      {/* Per-worker estimate */}
      <div className="flex gap-1.5">
        {Array.from({ length: maxWorker }).map((_, i) => (
          <div key={i} className={`flex-1 h-6 rounded flex items-center justify-center text-[9px] font-bold transition-all ${i < workerCount
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
    const isDone = completedChapters.has(chap.index);
    return (
      <div
        key={chap.id}
        ref={isActive ? activeChapRef : undefined}
        onClick={() => {
          setShowChapterList(false);
          goToChapter(chap); // không await — tránh block UI
        }}
        className={`group flex items-center gap-3 h-[40px] px-4 cursor-pointer border-l-[2px] transition-all ${isActive
          ? 'bg-[#e8580a]/10 border-l-[#e8580a]'
          : 'border-l-transparent hover:bg-white/[0.05] hover:border-l-white/20'
          }`}
      >
        <span className={`text-[11px] font-medium w-7 text-center shrink-0 tabular-nums ${isActive ? 'text-[#e8580a]' : 'text-[#8a7e72]'}`}>
          {chap.index}
        </span>
        <div className="flex-1 min-w-0">
          <p className={`text-[13px] leading-snug ${isActive ? 'text-[#e8580a] font-semibold' : 'text-[#c0b4a8] group-hover:text-white'}`}>
            {chap.title}
          </p>
          {isActive && <p className="text-[9px] text-[#e8580a]/70 mt-0.5">Đang nghe</p>}
        </div>
        {isActive
          ? <WaveIcon color="#e8580a" />
          : isDone
            ? <CheckCircle2 size={12} className="text-green-500/60 shrink-0" />
            : <div className="w-[12px]" />}
      </div>
    );
  }, [currentIdx, completedChapters, goToChapter]);

  // 4 chương preview quanh chapter hiện tại (mobile)
  const previewChaps = (() => {
    const curPos = sortedChapters.findIndex(c => c.index === currentIdx);
    return sortedChapters.slice(curPos, curPos + 3);
  })();

  // ─────────────────────────────────────────────────────────
  // ── INFO PANEL ──
  // ─────────────────────────────────────────────────────────
  const fmtNum = (n: number) => n > 999 ? (n / 1000).toFixed(1) + 'k' : String(n);

  const InfoPanel = (
    <div className="flex flex-col gap-4 px-4 py-4">

      {/* Rating stars + nút đánh giá */}
      <div className="flex items-center gap-2 flex-wrap">
        {storyInfo.ratingScore > 0 && (
          <>
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map(i => (
                <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill={i <= Math.round(storyInfo.ratingScore) ? '#f59e0b' : '#f59e0b'} stroke="#f59e0b" strokeWidth="1.5" opacity={i <= Math.round(storyInfo.ratingScore) ? 1 : 0.3}>
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              ))}
            </div>
            <span className="text-[13px] font-bold text-[#f0ebe4]">{storyInfo.ratingScore.toFixed(1)}</span>
            <span className="text-[11px] text-[#8a7e72]">({storyInfo.ratingCount})</span>
          </>
        )}
        <ReviewButton
          storyId={storyInfo.id}
          text="Đánh giá"
          currentUser={currentUser}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-white/[0.06] text-[#f0ebe4] border border-white/[0.15] hover:bg-white/[0.1] transition-all active:scale-95"
        />
      </div>

      {/* Interaction bar — giống StoryInteractions: label trên, icon+số dưới, click được */}
      <div className="flex rounded-xl overflow-hidden border border-white/[0.10]">

        {/* Yêu thích */}
        <button
          onClick={handleLike}
          aria-pressed={userStatus.isLiked}
          aria-label={userStatus.isLiked ? 'Bỏ yêu thích' : 'Yêu thích'}
          className={`flex-1 flex flex-col items-center cursor-pointer transition-all active:scale-95 ${userStatus.isLiked ? 'bg-red-500/10' : 'bg-transparent hover:bg-white/[0.03]'
            }`}
        >
          <div className={`w-full text-center px-2 py-1 text-[9px] font-semibold border-b border-white/[0.08] ${userStatus.isLiked ? 'text-red-400 bg-red-500/10' : 'text-white bg-white/[0.03]'
            }`}>+ Yêu thích</div>
          <div className="flex items-center justify-center gap-1.5 py-2.5">
            <Heart size={14} className={`transition-all ${userStatus.isLiked ? 'fill-current text-red-500 scale-110' : 'text-red-400'}`} />
            <span className={`text-[16px] font-bold ${userStatus.isLiked ? 'text-red-500' : 'text-[#f0ebe4]'}`}>{interactStats.likeCount}</span>
          </div>
        </button>

        <div className="w-px bg-white/[0.08]" />

        {/* Theo dõi */}
        <button
          onClick={handleFollow}
          aria-pressed={userStatus.isFollowed}
          aria-label={userStatus.isFollowed ? 'Bỏ theo dõi' : 'Theo dõi'}
          className={`flex-1 flex flex-col items-center cursor-pointer transition-all active:scale-95 ${userStatus.isFollowed ? 'bg-blue-500/10' : 'bg-transparent hover:bg-white/[0.03]'
            }`}
        >
          <div className={`w-full text-center px-2 py-1 text-[9px] font-semibold border-b border-white/[0.08] ${userStatus.isFollowed ? 'text-blue-400 bg-blue-500/10' : 'text-white bg-white/[0.03]'
            }`}>+ Theo dõi</div>
          <div className="flex items-center justify-center gap-1.5 py-2.5">
            <Bookmark size={14} className={`transition-all ${userStatus.isFollowed ? 'fill-current text-blue-500 scale-110' : 'text-blue-400'}`} />
            <span className={`text-[16px] font-bold ${userStatus.isFollowed ? 'text-blue-500' : 'text-[#f0ebe4]'}`}>{interactStats.followCount}</span>
          </div>
        </button>

        <div className="w-px bg-white/[0.08]" />

        {/* Đề cử */}
        <button
          onClick={handleNominate}
          aria-label="Đề cử"
          className="flex-1 flex flex-col items-center cursor-pointer bg-transparent hover:bg-white/[0.03] transition-all active:scale-95"
        >
          <div className="w-full text-center px-2 py-1 text-[9px] font-semibold border-b border-white/[0.08] text-white bg-white/[0.03]">+ Đề cử</div>
          <div className="flex items-center justify-center gap-1.5 py-2.5">
            <Trophy size={14} className="text-amber-400" />
            <span className="text-[16px] font-bold text-[#f0ebe4]">{interactStats.nominationCount}</span>
          </div>
        </button>
      </div>

      {/* Status + Genres */}
      <div className="flex flex-wrap gap-2">
        <span className="text-[11px] font-bold px-3 py-1.5 rounded-full bg-transparent text-[#e8580a] border border-[#e8580a]/40">
          {statusLabel(storyInfo.status)}
        </span>
        <span className="text-[11px] px-3 py-1.5 rounded-full bg-white/[0.04] text-white border border-white/[0.08]">
          {totalChapters} chương
        </span>
        {storyInfo.genres.map(g => (
          <span key={g} className="text-[11px] px-3 py-1.5 rounded-full bg-white/[0.04] text-white border border-white/[0.08]">{g}</span>
        ))}
      </div>

      {/* Description */}
      {storyInfo.description && (
        <div>
          <p className="text-[12px] font-black uppercase tracking-[.1em] text-white mb-3">Giới thiệu</p>
          <div className="relative">
            <p className={`text-[14px] text-white leading-relaxed transition-all ${descExpanded ? '' : 'line-clamp-6'}`}>
              {storyInfo.description}
            </p>
            {!descExpanded && (
              <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-[#0f0d0a] to-transparent pointer-events-none" />
            )}
          </div>
          <button
            onClick={() => setDescExpanded(v => !v)}
            className="mt-2 flex items-center gap-1 text-[11px] font-bold text-[#e8580a] hover:text-[#ff7c35] transition-colors"
          >
            {descExpanded ? (
              <>Thu gọn <ChevronDown size={12} className="rotate-180 transition-transform" /></>
            ) : (
              <>Xem thêm <ChevronDown size={12} className="transition-transform" /></>
            )}
          </button>
        </div>
      )}

      {/* Reviews */}
      {storyInfo.reviews?.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[12px] font-black uppercase tracking-[.1em] text-white">
              Đánh giá
              <span className="ml-1.5 text-[#8a7e72] font-normal normal-case tracking-normal">({storyInfo.reviews.length})</span>
            </p>
            {storyInfo.reviews.length > REVIEWS_PER_PAGE && (
              <span className="text-[10px] text-[#8a7e72]">
                Trang {reviewPage} / {Math.ceil(storyInfo.reviews.length / REVIEWS_PER_PAGE)}
              </span>
            )}
          </div>

          {/* Scrollable review list */}
          <div className="space-y-2.5">
            {storyInfo.reviews
              .slice((reviewPage - 1) * REVIEWS_PER_PAGE, reviewPage * REVIEWS_PER_PAGE)
              .map(r => (
                <div key={r.id} className="bg-white/[0.04] border border-white/[0.07] rounded-xl px-3 py-3">
                  <div className="flex items-center gap-2 mb-2">
                    {r.user.image
                      ? <img src={r.user.image} alt={r.user.name} className="w-7 h-7 rounded-full object-cover" />
                      : <div className="w-7 h-7 rounded-full bg-white/[0.1] flex items-center justify-center text-[11px] font-bold text-white">{r.user.name?.[0]?.toUpperCase()}</div>
                    }
                    <span className="text-[12px] font-bold text-[#f0ebe4]">{r.user.name}</span>
                    <div className="flex items-center gap-0.5 ml-auto">
                      {[1,2,3,4,5].map(i => (
                        <svg key={i} width="10" height="10" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" strokeWidth="1.5" opacity={i <= r.rating ? 1 : 0.25}>
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                      ))}
                    </div>
                  </div>
                  {r.content && <p className="text-[12px] text-[#c0b9b0] leading-relaxed">{r.content}</p>}
                  <p className="text-[10px] text-[#8a7e72] mt-1.5">{new Date(r.createdAt).toLocaleDateString('vi-VN')}</p>
                </div>
              ))}
          </div>

          {/* Pagination controls */}
          {storyInfo.reviews.length > REVIEWS_PER_PAGE && (
            <div className="flex items-center justify-center gap-2 mt-3">
              <button
                onClick={() => setReviewPage(p => Math.max(1, p - 1))}
                disabled={reviewPage === 1}
                className="px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08] text-[11px] text-[#f0ebe4] disabled:opacity-30 hover:bg-white/[0.1] transition-colors"
              >
                ‹ Trước
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.ceil(storyInfo.reviews.length / REVIEWS_PER_PAGE) }).map((_, i) => {
                  const pg = i + 1;
                  const total = Math.ceil(storyInfo.reviews.length / REVIEWS_PER_PAGE);
                  if (total <= 7 || pg === 1 || pg === total || Math.abs(pg - reviewPage) <= 1) {
                    return (
                      <button
                        key={pg}
                        onClick={() => setReviewPage(pg)}
                        className={`w-6 h-6 rounded text-[10px] font-bold transition-colors ${reviewPage === pg
                          ? 'bg-[#e8580a] text-white'
                          : 'bg-white/[0.05] text-[#8a7e72] hover:bg-white/[0.1]'
                        }`}
                      >
                        {pg}
                      </button>
                    );
                  }
                  if (Math.abs(pg - reviewPage) === 2) {
                    return <span key={pg} className="text-[10px] text-[#8a7e72]">…</span>;
                  }
                  return null;
                })}
              </div>
              <button
                onClick={() => setReviewPage(p => Math.min(Math.ceil(storyInfo.reviews.length / REVIEWS_PER_PAGE), p + 1))}
                disabled={reviewPage === Math.ceil(storyInfo.reviews.length / REVIEWS_PER_PAGE)}
                className="px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08] text-[11px] text-[#f0ebe4] disabled:opacity-30 hover:bg-white/[0.1] transition-colors"
              >
                Sau ›
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );

  // ─────────────────────────────────────────────────────────
  // ── COMMENTS PANEL ──
  // ─────────────────────────────────────────────────────────
  const totalCommentPages = Math.max(1, Math.ceil(comments.length / COMMENTS_PER_PAGE));
  const pagedComments = comments.slice((commentPage - 1) * COMMENTS_PER_PAGE, commentPage * COMMENTS_PER_PAGE);

  const CommentsPanel = (
    <div className="flex flex-col h-full">
      {/* Comment list */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">

        {/* Load more older (from server) */}
        {commentHasMore && (
          <div className="flex justify-center pb-3">
            <button
              onClick={handleLoadMoreComments}
              disabled={commentLoadingMore}
              className="text-[10px] text-[#e8580a] hover:underline flex items-center gap-1.5 disabled:opacity-50"
            >
              {commentLoadingMore
                ? <><Loader2 size={11} className="animate-spin" /> Đang tải...</>
                : 'Xem bình luận cũ hơn'}
            </button>
          </div>
        )}

        {commentLoading ? (
          <div className="flex justify-center py-8" role="status" aria-label="Đang tải bình luận...">
            <Loader2 size={18} className="animate-spin text-[#8a7e72]" />
          </div>
        ) : comments.length === 0 ? (
          <p className="text-[11px] text-[#8a7e72] text-center py-8 italic">Chưa có bình luận nào. Hãy là người đầu tiên! 💬</p>
        ) : (
          <>
            {/* Page info header */}
            <div className="flex items-center justify-between pb-2 px-0.5">
              <span className="text-[10px] text-[#8a7e72]">
                {comments.length} bình luận
              </span>
              {totalCommentPages > 1 && (
                <span className="text-[10px] text-[#8a7e72]">
                  Trang {commentPage} / {totalCommentPages}
                </span>
              )}
            </div>

            <ol aria-label="Danh sách bình luận" className="space-y-0.5">
              {pagedComments.map(cmt => (
                <li key={cmt.id} className="flex gap-2.5 p-2.5 rounded-xl hover:bg-white/[0.03] transition-colors">
                  {getAvatar(cmt.user.name, cmt.user.image, 28)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                      <span className="text-[14px] font-bold text-white">{cmt.user.name}</span>
                      {cmt.user.role === 'ADMIN' && (
                        <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-[#e8580a] text-white uppercase tracking-wider">Admin</span>
                      )}
                      <time dateTime={cmt.createdAt} className="text-[12px] text-white/80">{timeAgo(cmt.createdAt)}</time>
                    </div>
                    <p className="text-[14px] text-white leading-relaxed mb-1.5 whitespace-pre-wrap">{cmt.content}</p>
                    <div className="flex items-center gap-3">
                      {/* Like */}
                      <button
                        onClick={() => handleLikeComment(cmt.id)}
                        aria-label={`${cmt.isLiked ? 'Bỏ thích' : 'Thích'} bình luận của ${cmt.user.name}. ${cmt.likeCount} lượt thích`}
                        aria-pressed={cmt.isLiked}
                        className={`flex items-center gap-1 text-[13px] font-semibold transition-colors ${cmt.isLiked ? 'text-[#e8580a]' : 'text-[#e8580a] hover:opacity-80'}`}
                      >
                        <Heart size={11} className={cmt.isLiked ? 'fill-current' : ''} />
                        <span>{cmt.likeCount > 0 ? cmt.likeCount : 'Thích'}</span>
                      </button>
                      {/* Reply */}
                      <button
                        onClick={() => handleReplyComment(cmt)}
                        aria-label={`Trả lời bình luận của ${cmt.user.name}`}
                        className="flex items-center gap-1 text-[13px] font-semibold text-[#e8580a] transition-colors"
                      >
                        <CornerDownRight size={11} />
                        Trả lời
                      </button>
                      {/* Delete */}
                      {currentUser && (currentUser.id === cmt.user.id || currentUser.role === 'ADMIN') && (
                        <button
                          onClick={() => {
                            if (confirm('Bạn có chắc muốn xóa bình luận này?')) handleDeleteComment(cmt.id);
                          }}
                          aria-label={`Xóa bình luận của ${cmt.user.name}`}
                          className="flex items-center gap-1 text-[10px] text-[#8a7e72] hover:text-red-500 transition-colors ml-auto"
                        >
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ol>

            {/* Comment pagination controls */}
            {totalCommentPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-3 pb-1">
                <button
                  onClick={() => setCommentPage(p => Math.max(1, p - 1))}
                  disabled={commentPage === 1}
                  className="px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08] text-[11px] text-[#f0ebe4] disabled:opacity-30 hover:bg-white/[0.1] transition-colors"
                >
                  ‹ Trước
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalCommentPages }).map((_, i) => {
                    const pg = i + 1;
                    if (totalCommentPages <= 7 || pg === 1 || pg === totalCommentPages || Math.abs(pg - commentPage) <= 1) {
                      return (
                        <button
                          key={pg}
                          onClick={() => setCommentPage(pg)}
                          className={`w-6 h-6 rounded text-[10px] font-bold transition-colors ${commentPage === pg
                            ? 'bg-[#e8580a] text-white'
                            : 'bg-white/[0.05] text-[#8a7e72] hover:bg-white/[0.1]'
                          }`}
                        >
                          {pg}
                        </button>
                      );
                    }
                    if (Math.abs(pg - commentPage) === 2) {
                      return <span key={pg} className="text-[10px] text-[#8a7e72]">…</span>;
                    }
                    return null;
                  })}
                </div>
                <button
                  onClick={() => setCommentPage(p => Math.min(totalCommentPages, p + 1))}
                  disabled={commentPage === totalCommentPages}
                  className="px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08] text-[11px] text-[#f0ebe4] disabled:opacity-30 hover:bg-white/[0.1] transition-colors"
                >
                  Sau ›
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Input box */}
      <div className="px-3 py-3 border-t border-white/[0.06] shrink-0">
        {/* Reply badge */}
        {replyTo && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[10px] text-[#8a7e72] mb-2">
            <CornerDownRight size={11} className="shrink-0" />
            <span>Trả lời <strong className="text-[#f0ebe4]">{replyTo.name}</strong></span>
            <button onClick={() => setReplyTo(null)} className="ml-auto hover:text-[#f0ebe4]" aria-label="Hủy trả lời">
              <X size={11} />
            </button>
          </div>
        )}
        <div className="flex gap-2 items-end">
          {currentUser && getAvatar(currentUser.name, currentUser.image, 24)}
          <textarea
            ref={commentTextareaRef}
            value={commentInput}
            onChange={e => setCommentInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSendComment(); }}
            placeholder={
              currentUser
                ? replyTo
                  ? `Trả lời ${replyTo.name}...`
                  : 'Chia sẻ cảm nhận... (≥20 ký tự để nhận +0.2 credit)'
                : 'Đăng nhập để bình luận...'
            }
            rows={2}
            aria-label="Nội dung bình luận"
            disabled={!currentUser || commentCooldown > 0}
            className="flex-1 bg-[#1a1612] border border-white/[0.08] rounded-lg px-3 py-2 text-[11px] text-[#f0ebe4] placeholder:text-[#8a7e72] outline-none focus:border-[#e8580a]/50 resize-none disabled:opacity-50"
          />
          <button
            onClick={handleSendComment}
            disabled={commentSending || !commentInput.trim() || commentCooldown > 0}
            aria-label={
              commentCooldown > 0
                ? `Chờ ${commentCooldown}s`
                : commentSending ? 'Đang gửi...' : replyTo ? 'Gửi trả lời' : 'Gửi bình luận'
            }
            className="px-2.5 py-2 bg-[#e8580a] rounded-lg text-white disabled:opacity-40 hover:bg-[#d4500a] transition-colors shrink-0 min-w-[36px] flex items-center justify-center"
          >
            {commentSending
              ? <Loader2 size={13} className="animate-spin" />
              : commentCooldown > 0
              ? <span className="text-[10px] font-mono font-black">{commentCooldown}s</span>
              : <Send size={13} />}
          </button>
        </div>
        {currentUser && (
          <p className="text-[9px] text-[#8a7e72] mt-1 text-right">
            {commentCooldown > 0 ? `Chờ ${commentCooldown}s trước khi gửi tiếp` : 'Ctrl+Enter để gửi'}
          </p>
        )}
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────
  // ── RENDER ──
  // ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0f0d0a] relative">
      {/* ── Credit Toast — fixed overlay, dùng chung cho like / nominate / comment ── */}
      {creditToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[9999] pointer-events-auto max-w-[340px] w-[calc(100vw-32px)] animate-in fade-in slide-in-from-bottom-3 duration-300">
          <div className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-[12px] font-semibold border shadow-2xl backdrop-blur-md ${
            creditToast.startsWith('✅')
              ? 'bg-green-900/80 border-green-600/50 text-green-200'
              : 'bg-amber-900/80 border-amber-600/50 text-amber-200'
          }`} role="status" aria-live="polite">
            <span className="flex-1 leading-snug">{creditToast}</span>
            <button onClick={() => setCreditToast(null)} className="shrink-0 opacity-60 hover:opacity-100 transition-opacity" aria-label="Đóng thông báo">
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      {/* ── Version Badge ── */}
      <div className="fixed bottom-16 right-3 z-50 pointer-events-none">
        <div className="bg-[#1a1612]/90 border border-white/[0.07] rounded-lg px-2 py-1">
          <span className="text-[10px] font-black text-[#e8580a]">v 6.1</span>
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
          className="w-8 h-8 rounded-lg bg-black/60 backdrop-blur-sm border border-white/[0.25] flex items-center justify-center text-white hover:text-white hover:border-white/50 transition-colors flex-shrink-0">
          <ArrowLeft size={15} />
        </Link>
        <div className="bg-black/50 backdrop-blur-sm border border-white/[0.08] rounded-lg px-3 py-1.5 max-w-[260px] min-w-0">
          <p className="text-[13px] font-bold text-white truncate leading-tight">{storyTitle}</p>
        </div>
        <button onClick={() => setShowChapterList(true)}
          className="lg:hidden w-8 h-8 rounded-lg bg-black/60 backdrop-blur-sm border border-white/[0.25] flex items-center justify-center text-white hover:border-white/50 transition-colors">
          <List size={15} />
        </button>
        <button onClick={() => handleMobileDrawer('info')}
          className="lg:hidden w-8 h-8 rounded-lg bg-black/60 backdrop-blur-sm border border-white/[0.25] flex items-center justify-center text-white hover:border-white/50 transition-colors">
          <Info size={15} />
        </button>
        <button onClick={() => handleMobileDrawer('comments')}
          className="lg:hidden w-8 h-8 rounded-lg bg-black/60 backdrop-blur-sm border border-white/[0.25] flex items-center justify-center text-white hover:border-white/50 transition-colors">
          <MessageSquare size={15} />
        </button>
      </div>

      {/* ════ MOBILE (< lg) — full screen như mockup ════ */}
      <div className="lg:hidden relative min-h-screen">
        {/* Cover centered - not full screen */}
        <div className="absolute inset-0">
          {storyCover
            ? <>
              <div className="absolute inset-0 bg-cover bg-center opacity-20 blur-xl scale-110"
                style={{ backgroundImage: `url(${storyCover})` }} />
              <div className="absolute inset-0 flex items-center justify-center" style={{ top: '60px', bottom: '320px' }}>
                <img src={storyCover} alt={storyTitle}
                  className="max-h-full max-w-[75%] object-contain drop-shadow-2xl rounded-lg" />
              </div>
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
              <h1 className="font-serif text-[20px] font-bold text-white leading-tight mb-1">
                {currentChapter.title || `Chương ${currentIdx}`}
              </h1>
              <p className="text-[12px] text-[#c0b4a8]">{author}</p>
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
      <div className="hidden lg:grid lg:grid-cols-12 h-screen relative bg-[#0a0806] overflow-hidden">
        {/* Shared Desktop Background */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          {storyCover ? (
            <div className="absolute inset-0 bg-cover bg-center opacity-20 blur-xl scale-110"
              style={{ backgroundImage: `url(${storyCover})` }} />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-[#4a2f10] to-[#1a0e06]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0f0d0a] via-[#0f0d0a]/30 to-transparent" />
        </div>

        {/* LEFT 9 cols — cover full + controls căn bottom */}
        <div className="col-span-9 relative z-10 overflow-hidden">
          {/* Cover full */}
          <div className="absolute inset-0 flex items-center justify-center">
            {storyCover
              ? <img src={storyCover} alt={storyTitle} className="relative z-10 object-contain drop-shadow-2xl" style={{ maxHeight: '65%', maxWidth: '55%' }} />
              : <Headphones size={80} className="text-[#e8580a]/20" />
            }
          </div>

          {/* Controls căn bottom */}
          <div className="absolute bottom-0 left-0 right-0 px-8 pb-8 flex flex-col gap-5">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[#e8580a]/50 bg-[#e8580a]/10 mb-2">
                <Headphones size={9} className="text-[#e8580a]" />
                <span className="text-[9px] font-black tracking-[.12em] uppercase text-[#e8580a]">Chương {currentIdx}</span>
              </div>
              <h1 className="font-serif text-[26px] font-bold text-white leading-tight mb-1">
                {currentChapter.title || `Chương ${currentIdx}`}
              </h1>
              <p className="text-[13px] text-[#c0b4a8]">{author}</p>
            </div>
            {DebugPanel}
            {Controls}
            {VoiceSpeed}
            {WorkerPanel}
          </div>
        </div>

        {/* RIGHT 3 cols — tabbed panel */}
        <div className="col-span-3 relative z-10 flex flex-col bg-black/20 backdrop-blur-md border-l border-white/[0.06] h-screen">
          {/* Tab bar */}
          <div className="flex border-b border-white/[0.06] flex-shrink-0">
            {([
              { id: 'chapters', icon: <List size={11} />, label: 'Chương' },
              { id: 'info', icon: <Info size={11} />, label: 'Thông tin' },
              { id: 'comments', icon: <MessageSquare size={11} />, label: 'Bình luận' },
            ] as { id: DrawerTab; icon: React.ReactNode; label: string }[]).map(tab => (
              <button
                key={tab.id}
                onClick={() => handleDesktopTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1 py-2.5 text-[13px] font-black uppercase tracking-[.06em] transition-colors border-b-[1.5px] ${desktopTab === tab.id
                  ? 'text-[#e8580a] border-[#e8580a]'
                  : 'text-white border-transparent hover:text-[#e8580a]'
                  }`}
              >
                {tab.icon}{tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto">
            {desktopTab === 'chapters' && (
              <>
                {sortedChapters.slice(0, desktopVisible).map(renderChapRow)}
                {(desktopVisible < sortedChapters.length || hasMoreChaps) && (
                  <div ref={desktopSentinelRef} className="h-12 flex items-center justify-center">
                    <span className="text-[10px] text-[#8a7e72] animate-pulse">Đang tải thêm...</span>
                  </div>
                )}
              </>
            )}
            {desktopTab === 'info' && InfoPanel}
            {desktopTab === 'comments' && CommentsPanel}
          </div>
        </div>
      </div>

      {/* ════ MOBILE CHAPTER DRAWER ════ */}
      {showChapterList && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col bg-[#0f0d0a]/96 backdrop-blur-sm">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.07] flex-shrink-0">
            <span className="text-[15px] font-black text-[#ffffff] uppercase tracking-[.08em]">Tất cả chương</span>
            <button onClick={() => setShowChapterList(false)}
              className="w-8 h-8 rounded-lg bg-white/[0.07] flex items-center justify-center text-[#8a7e72]">
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto" ref={chapListRef}>
            {sortedChapters.slice(0, mobileVisible).map(renderChapRow)}
            {(mobileVisible < sortedChapters.length || hasMoreChaps) && (
              <div ref={mobileSentinelRef} className="h-12 flex items-center justify-center">
                <span className="text-[10px] text-[#8a7e72] animate-pulse">Đang tải thêm...</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════ MOBILE INFO DRAWER ════ */}
      {mobileDrawer === 'info' && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col bg-[#0f0d0a]/96 backdrop-blur-sm">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.07] flex-shrink-0">
            <span className="text-[15px] font-black text-[#ffffff] uppercase tracking-[.08em]">Thông tin truyện</span>
            <button onClick={() => setMobileDrawer(null)}
              className="w-8 h-8 rounded-lg bg-white/[0.07] flex items-center justify-center text-[#8a7e72]">
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {InfoPanel}
          </div>
        </div>
      )}

      {/* ════ MOBILE COMMENTS DRAWER ════ */}
      {mobileDrawer === 'comments' && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col bg-[#0f0d0a]/96 backdrop-blur-sm">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.07] flex-shrink-0">
            <span className="text-[15px] font-black text-[#ffffff] uppercase tracking-[.08em]">
              Bình luận {comments.length > 0 ? `(${comments.length})` : ''}
            </span>
            <button onClick={() => setMobileDrawer(null)}
              className="w-8 h-8 rounded-lg bg-white/[0.07] flex items-center justify-center text-[#8a7e72]">
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-hidden flex flex-col">
            {CommentsPanel}
          </div>
        </div>
      )}
    </div>
  );
}
