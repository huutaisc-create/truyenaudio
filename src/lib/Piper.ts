export interface PiperConfig {
    voiceId?: string;
    modelUrl: string;
    modelConfigUrl: string;
    speakerId?: number;
    inference?: {
        noiseScale?: number;
        lengthScale?: number;
        noiseW?: number;
    };
}

export interface PiperVoice {
    key: string;
    name: string;
    language: { code: string; name_native: string };
    country: { code: string; name_english: string };
    quality: string;
    num_speakers: number;
    files: Record<string, { size_bytes: number; md5_digest: string }>;
}

interface PiperJob {
    resolve: (blob: Blob) => void;
    reject: (err: any) => void;
}

export class Piper {
    private worker: Worker | null = null;
    private currentJob: PiperJob | null = null;

    constructor() { }

    private initWorker() {
        if (typeof window === "undefined") return;

        // Only create if not exists
        if (this.worker) return;

        console.log("[Piper] Initializing worker...");
        this.worker = new Worker(`/workers/tts-worker.js?v=${Date.now()}_fix13_ctrl`, { type: "module" });

        this.worker.onmessage = (e) => {
            const msg = e.data;
            if (msg.kind === "output" && this.currentJob) {
                this.currentJob.resolve(msg.file);
            } else if (msg.kind === "error" && this.currentJob) {
                this.currentJob.reject(msg.error);
                this.currentJob = null;
            } else if (msg.kind === "stderr") {
                console.warn("[Piper Worker]", msg.message);
            }
        };
        this.worker.onerror = (e) => {
            console.error("[Piper Worker Error]", e);
            if (this.currentJob) {
                this.currentJob.reject("Worker Error");
                this.currentJob = null;
            }
        };
    }

    static async getVoices(): Promise<Record<string, PiperVoice>> {
        try {
            const res = await fetch('https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/voices.json');
            if (!res.ok) throw new Error('Failed to fetch voices');
            return res.json();
        } catch (error) {
            console.error("Error fetching standard voices:", error);
            return {};
        }
    }

    // Segment text into appropriate chunks for TTS
    private segmentText(text: string): string[] {
        // Use Intl.Segmenter if available for better locale-aware segmentation
        if (typeof Intl !== 'undefined' && (Intl as any).Segmenter) {
            const segmenter = new (Intl as any).Segmenter('vi', { granularity: 'sentence' });
            const segments = Array.from(segmenter.segment(text)).map((s: any) => s.segment);
            return segments;
        }
        // Fallback regex split
        return text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];
    }

    async speakStreaming(text: string, config: PiperConfig, onAudioChunk: (blob: Blob) => void): Promise<void> {
        // Ensure worker is ready
        this.initWorker();

        // Cancel previous job if any (by terminating worker to result state)
        if (this.currentJob) {
            console.log("[Piper] Interrupting previous job");
            this.terminate();
            this.initWorker();
        }

        const sentences = this.segmentText(text);
        console.log(`[Piper] Streaming ${sentences.length} sentences`);

        for (const sentence of sentences) {
            if (!sentence.trim()) continue;

            // Process one sentence at a time
            try {
                const blob = await this.processSentence(sentence, config);
                onAudioChunk(blob);
            } catch (e) {
                console.error("[Piper] Streaming error:", e);
                throw e; // Stop streaming on error
            }
        }
    }

    private async processSentence(text: string, config: PiperConfig): Promise<Blob> {
        if (!this.worker) this.initWorker(); // Safety check

        return new Promise((resolve, reject) => {
            this.currentJob = { resolve, reject };

            this.worker!.postMessage({
                kind: "init",
                input: text,
                modelUrl: config.modelUrl,
                modelConfigUrl: config.modelConfigUrl,
                speakerId: config.speakerId || 0,
                piperPhonemizeJsUrl: "/piper-wasm/piper_phonemize.js",
                piperPhonemizeWasmUrl: "/piper-wasm/piper_phonemize.wasm",
                piperPhonemizeDataUrl: "/piper-wasm/piper_phonemize.data",
                onnxruntimeUrl: "/piper-wasm",
                blobs: {},
                ...config.inference
            });
        });
    }

    // Legacy/Simple method (waits for full text, but reusing streaming logic could be better?)
    // For now keep it simple for backward compat, but reusing processSentence is safer if we want single-sentence limit?
    // User wants speed, so they will use speakStreaming. This is just fallback.
    async speak(text: string, config: PiperConfig): Promise<Blob> {
        if (!this.worker) this.initWorker();

        if (this.currentJob) {
            this.currentJob.reject("Interrupted");
            this.terminate();
            this.initWorker();
        }

        // Monolithic speak
        return this.processSentence(text, config);
    }

    terminate() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
        if (this.currentJob) {
            this.currentJob.reject("Terminated");
            this.currentJob = null;
        }
    }
}

export const piper = new Piper();
