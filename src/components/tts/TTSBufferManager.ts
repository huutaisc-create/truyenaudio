import { piper, PiperConfig } from "@/lib/Piper";

export interface ChapterMeta {
  id: string;
  index: number;
  title: string;
  content: string;
  story: {
    id: string;
    title: string;
    slug: string;
    author: string;
    coverImage?: string | null;
  };
}

export interface TTSBufferManagerOptions {
  config: PiperConfig;
  /** Gọi khi có blob mới (từng câu) — dùng để push vào audio queue */
  onChunk: (blob: Blob, chapterId: string) => void;
  /** Gọi khi bắt đầu stream chương mới */
  onChapterStart?: (chapter: ChapterMeta) => void;
  /** Gọi khi stream xong 1 chương */
  onChapterDone?: (chapterId: string) => void;
  /** Gọi khi có lỗi */
  onError?: (err: unknown) => void;
}

export class TTSBufferManager {
  private config: PiperConfig;
  private onChunk: (blob: Blob, chapterId: string) => void;
  private onChapterStart?: (chapter: ChapterMeta) => void;
  private onChapterDone?: (chapterId: string) => void;
  private onError?: (err: unknown) => void;

  /** ID chương đang phát hiện tại */
  private currentChapterId: string | null = null;

  /** ID chương đang prefetch ngầm */
  private prefetchingChapterId: string | null = null;

  /** Blob đã buffer sẵn của chương tiếp theo: chapterId → Blob[] */
  private prefetchedBlobs: Map<string, Blob[]> = new Map();

  /** Prefetch đã xong chưa */
  private prefetchDone: Map<string, boolean> = new Map();

  /** AbortController để cancel prefetch nếu cần */
  private prefetchAbort: AbortController | null = null;

  constructor(options: TTSBufferManagerOptions) {
    this.config = options.config;
    this.onChunk = options.onChunk;
    this.onChapterStart = options.onChapterStart;
    this.onChapterDone = options.onChapterDone;
    this.onError = options.onError;
  }

  /** Update config (giọng đọc, speed, ...) */
  updateConfig(config: PiperConfig) {
    this.config = config;
  }

  /** Fetch nội dung chương từ API */
  private async fetchChapter(chapterId: string): Promise<ChapterMeta | null> {
    try {
      const res = await fetch(`/api/chapters/${chapterId}`);
      if (!res.ok) return null;
      const json = await res.json();
      // Route trả về { success: true, data: chapter }
      return json.data as ChapterMeta;
    } catch {
      return null;
    }
  }

  /**
   * Phát chương — stream từng câu ngay lập tức.
   * Nếu chương này đã có blob prefetch sẵn → flush buffer trước, rồi tiếp tục stream phần còn lại.
   * Sau khi stream xong → tự động prefetch chương tiếp theo ngầm.
   */
  async playChapter(chapterId: string, nextChapterId?: string): Promise<void> {
    this.currentChapterId = chapterId;

    // Cancel prefetch cũ nếu đang prefetch chương khác
    if (
      this.prefetchingChapterId &&
      this.prefetchingChapterId !== chapterId &&
      this.prefetchingChapterId !== nextChapterId
    ) {
      this.cancelPrefetch();
    }

    // Nếu chương này đã được prefetch xong → flush hết blob ra luôn
    const prefetched = this.prefetchedBlobs.get(chapterId);
    const isDone = this.prefetchDone.get(chapterId);

    if (prefetched && prefetched.length > 0) {
      // Flush blob đã buffer
      for (const blob of prefetched) {
        this.onChunk(blob, chapterId);
      }
      this.prefetchedBlobs.delete(chapterId);

      if (isDone) {
        // Prefetch xong rồi, không cần stream thêm
        this.prefetchDone.delete(chapterId);
        this.onChapterDone?.(chapterId);
        if (nextChapterId) this.startPrefetch(nextChapterId);
        return;
      }
    }

    // Chưa prefetch hoặc chưa xong → fetch chapter rồi stream
    const chapter = await this.fetchChapter(chapterId);
    if (!chapter) {
      this.onError?.(`Không tìm thấy chương: ${chapterId}`);
      return;
    }

    this.onChapterStart?.(chapter);

    try {
      await piper.speakStreaming(chapter.content, this.config, (blob) => {
        if (this.currentChapterId !== chapterId) return; // Đã chuyển chương, bỏ qua
        this.onChunk(blob, chapterId);
      });

      this.onChapterDone?.(chapterId);

      // Stream xong → prefetch chương tiếp theo ngầm
      if (nextChapterId && this.currentChapterId === chapterId) {
        this.startPrefetch(nextChapterId);
      }
    } catch (err) {
      if (this.currentChapterId === chapterId) {
        this.onError?.(err);
      }
    }
  }

  /**
   * Prefetch ngầm chương tiếp theo — stream từng câu vào buffer.
   * Không phát ra ngoài, chỉ lưu vào prefetchedBlobs.
   */
  private async startPrefetch(chapterId: string): Promise<void> {
    if (this.prefetchingChapterId === chapterId) return; // Đang prefetch rồi
    if (this.prefetchDone.get(chapterId)) return; // Đã xong rồi

    this.cancelPrefetch();
    this.prefetchingChapterId = chapterId;
    this.prefetchAbort = new AbortController();
    const signal = this.prefetchAbort.signal;

    const chapter = await this.fetchChapter(chapterId);
    if (!chapter || signal.aborted) return;

    const blobs: Blob[] = [];
    this.prefetchedBlobs.set(chapterId, blobs);

    try {
      await piper.speakStreaming(chapter.content, this.config, (blob) => {
        if (signal.aborted) return;
        blobs.push(blob);
      });

      if (!signal.aborted) {
        this.prefetchDone.set(chapterId, true);
        this.prefetchingChapterId = null;
      }
    } catch {
      if (!signal.aborted) {
        this.prefetchingChapterId = null;
      }
    }
  }

  /** Cancel prefetch đang chạy */
  private cancelPrefetch() {
    if (this.prefetchAbort) {
      this.prefetchAbort.abort();
      this.prefetchAbort = null;
    }
    if (this.prefetchingChapterId) {
      this.prefetchedBlobs.delete(this.prefetchingChapterId);
      this.prefetchDone.delete(this.prefetchingChapterId);
      this.prefetchingChapterId = null;
    }
  }

  /** Dừng tất cả — gọi khi unmount hoặc đổi giọng */
  destroy() {
    this.currentChapterId = null;
    this.cancelPrefetch();
    this.prefetchedBlobs.clear();
    this.prefetchDone.clear();
    piper.terminate();
  }
}
