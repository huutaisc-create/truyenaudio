
// ── Cache ──────────────────────────────────────────────────
let cachedSession  = {};   // modelUrl → InferenceSession
let cachedConfig   = {};   // modelConfigUrl → parsed JSON
let blobCache      = {};   // url → Blob
let phonemizeReady = null; // Promise — phonemize WASM loaded once per worker

// ── Blob fetcher ────────────────────────────────────────────
async function getBlob(url, preloadedBlobs) {
    if (preloadedBlobs?.[url]) return preloadedBlobs[url];
    if (blobCache[url]) return blobCache[url];
    console.log(`[Worker] Fetching ${url}`);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    const blob = await response.blob();
    blobCache[url] = blob;
    return blob;
}

// ── Message router ──────────────────────────────────────────
self.addEventListener("message", (event) => {
    const data = event.data;

    if (data.kind === "init") {
        // Legacy: full pipeline backward compat với Piper.speak()
        init(data).catch(e => {
            console.error("[Worker] Init error:", e);
            self.postMessage({ kind: "error", error: e.toString() });
        });
    }

    if (data.kind === "infer") {
        // New: nhận phonemeIds → ONNX → trả raw PCM Float32Array
        infer(data).catch(e => {
            console.error("[Worker] Infer error:", e);
            self.postMessage({ kind: "inferError", jobId: data.jobId, error: e.toString() });
        });
    }

    if (data.kind === "phonemize_only") {
        // New: chỉ phonemize → trả phonemeIds
        phonemizeOnly(data).catch(e => {
            console.error("[Worker] Phonemize error:", e);
            self.postMessage({ kind: "phonemizeError", jobId: data.jobId, error: e.toString() });
        });
    }

    if (data.kind === "isAlive") {
        self.postMessage({ kind: "isAlive", isAlive: cachedSession[data.modelUrl] != null });
    }
});

// ── Load ONNX runtime (once per worker) ─────────────────────
async function ensureOrt(onnxruntimeUrl) {
    if (typeof ort !== 'undefined' && ort.InferenceSession) return;

    const base = onnxruntimeUrl.endsWith('/') ? onnxruntimeUrl : onnxruntimeUrl + '/';

    // SIMD: available Chrome 91+, Firefox 89+, Safari 16.4+ — KHÔNG cần crossOriginIsolated
    // Multi-thread (SharedArrayBuffer): cần crossOriginIsolated
    const isSecure   = self.crossOriginIsolated;
    const numThreads = isSecure ? (navigator.hardwareConcurrency || 4) : 1;

    console.log(`[Worker] SIMD=true Threads=${numThreads} Secure=${isSecure}`);

    self.ort = {
        env: {
            wasm: {
                numThreads,
                simd: true,          // bật unconditionally — không cần secure context
                proxy: isSecure,
                wasmPaths: base,
            }
        }
    };

    const module = await import(`${base}ort.min.mjs`);
    Object.assign(self.ort, module.default || module);
    if (!self.ort.InferenceSession && module.ort?.InferenceSession) {
        Object.assign(self.ort, module.ort);
    }
    console.log(`[Worker] ORT loaded — SIMD=true Threads=${numThreads}`);
}

// ── Load ONNX session (cached) ───────────────────────────────
async function ensureSession(modelUrl, blobs) {
    if (cachedSession[modelUrl]) return cachedSession[modelUrl];
    const modelBlob = await getBlob(modelUrl, blobs);
    const session   = await ort.InferenceSession.create(
        URL.createObjectURL(modelBlob),
        {
            executionProviders: ['wasm'], // WebGPU drop — int64 GatherND không support
            graphOptimizationLevel: 'all',
            enableCpuMemArena: true,
            enableMemPattern: true,
            executionMode: 'sequential',
        }
    );
    cachedSession[modelUrl] = session;
    console.log(`[Worker] Session cached for ${modelUrl}`);
    console.log('[Worker] EP: wasm (SIMD=true)');
    return session;
}

// ── Load model config (cached) ───────────────────────────────
async function ensureConfig(modelConfigUrl, blobs) {
    if (cachedConfig[modelConfigUrl]) return cachedConfig[modelConfigUrl];
    const blob   = await getBlob(modelConfigUrl, blobs);
    const config = JSON.parse(await blob.text());
    cachedConfig[modelConfigUrl] = config;
    return config;
}

// ── Load phonemize WASM (once per worker, lazy) ──────────────
async function ensurePhonemize(data) {
    if (phonemizeReady) return phonemizeReady;
    phonemizeReady = (async () => {
        const { blobs } = data;
        const piperJsBlob = await getBlob(data.piperPhonemizeJsUrl, blobs);
        const piperJsText = await piperJsBlob.text();
        const patched = new Blob(
            [piperJsText + "\n;self.createPiperPhonemize = createPiperPhonemize;"],
            { type: 'text/javascript' }
        );
        await import(URL.createObjectURL(patched));
        const wasmUrl = URL.createObjectURL(await getBlob(data.piperPhonemizeWasmUrl, blobs));
        const dataUrl = URL.createObjectURL(await getBlob(data.piperPhonemizeDataUrl, blobs));
        return { wasmUrl, dataUrl };
    })();
    return phonemizeReady;
}

// ── Run phonemize ────────────────────────────────────────────
async function runPhonemize(text, modelConfig, data) {
    const { wasmUrl, dataUrl } = await ensurePhonemize(data);
    return new Promise((resolve, reject) => {
        self.createPiperPhonemize({
            print: (line) => {
                try {
                    const parsed = JSON.parse(line);
                    if (parsed.phoneme_ids) resolve(parsed.phoneme_ids);
                } catch {}
            },
            printErr: (msg) => self.postMessage({ kind: "stderr", message: msg }),
            locateFile: (url) => {
                if (url.endsWith(".wasm")) return wasmUrl;
                if (url.endsWith(".data")) return dataUrl;
                return url;
            },
        }).then(module => {
            module.callMain([
                "-l", modelConfig.espeak.voice,
                "--input", JSON.stringify([{ text }]),
                "--espeak_data", "/espeak-ng-data",
            ]);
        }).catch(reject);
    });
}

// ── phonemize_only: text → phonemeIds ───────────────────────
async function phonemizeOnly(data) {
    const { jobId, input, modelConfigUrl, blobs } = data;
    const modelConfig = await ensureConfig(modelConfigUrl, blobs);
    const phonemeIds  = await runPhonemize(input, modelConfig, data);
    self.postMessage({ kind: "phonemizeResult", jobId, phonemeIds });
}

// ── infer: phonemeIds → raw PCM (zero-copy Transferable) ─────
async function infer(data) {
    const {
        jobId, phonemeIds, speakerId,
        modelUrl, modelConfigUrl, onnxruntimeUrl, blobs,
        noiseScale, lengthScale, noiseW,
    } = data;

    await ensureOrt(onnxruntimeUrl);
    const modelConfig = await ensureConfig(modelConfigUrl, blobs);
    const session     = await ensureSession(modelUrl, blobs);

    const sampleRate = modelConfig.audio.sample_rate;
    const feeds = {
        input:         new ort.Tensor("int64", phonemeIds, [1, phonemeIds.length]),
        input_lengths: new ort.Tensor("int64", [phonemeIds.length]),
        scales:        new ort.Tensor("float32", [
            noiseScale  ?? modelConfig.inference.noise_scale,
            lengthScale ?? modelConfig.inference.length_scale,
            noiseW      ?? modelConfig.inference.noise_w,
        ]),
    };
    if (Object.keys(modelConfig.speaker_id_map).length) {
        feeds.sid = new ort.Tensor("int64", [speakerId || 0]);
    }

    const { output: { data: pcm } } = await session.run(feeds);

    // Clone vì ort tensor buffer có thể bị reclaim sau khi session.run() return
    const pcmOut = new Float32Array(pcm);

    // Transfer zero-copy — không encode WAV, không tạo Blob, không ObjectURL
    self.postMessage(
        { kind: "inferResult", jobId, pcm: pcmOut, sampleRate },
        [pcmOut.buffer]
    );
}

// ── Legacy init: full pipeline (Piper.speak() backward compat) ─
async function init(data) {
    const { input, speakerId, blobs, modelUrl, modelConfigUrl, onnxruntimeUrl } = data;
    const modelConfig = await ensureConfig(modelConfigUrl, blobs);

    let phonemeIds = data.phonemeIds;
    if (!phonemeIds) phonemeIds = await runPhonemize(input, modelConfig, data);

    const phonemeIdMap = Object.entries(modelConfig.phoneme_id_map);
    const idPhonemeMap = Object.fromEntries(phonemeIdMap.map(([k, v]) => [v[0], k]));
    const phonemes     = phonemeIds.map(id => idPhonemeMap[id]);

    await ensureOrt(onnxruntimeUrl);
    const session    = await ensureSession(modelUrl, blobs);
    const sampleRate = modelConfig.audio.sample_rate;

    const feeds = {
        input:         new ort.Tensor("int64", phonemeIds, [1, phonemeIds.length]),
        input_lengths: new ort.Tensor("int64", [phonemeIds.length]),
        scales:        new ort.Tensor("float32", [
            data.noiseScale  ?? modelConfig.inference.noise_scale,
            data.lengthScale ?? modelConfig.inference.length_scale,
            data.noiseW      ?? modelConfig.inference.noise_w,
        ]),
    };
    if (Object.keys(modelConfig.speaker_id_map).length)
        feeds.sid = new ort.Tensor("int64", [speakerId || 0]);

    const { output: { data: pcm } } = await session.run(feeds);
    const result = PCM2WAV(pcm, sampleRate, 1);
    const file   = new Blob([result.wavBuffer], { type: "audio/x-wav" });
    self.postMessage({ kind: "output", input, file, duration: Math.floor(result.duration * 1000), phonemes, phonemeIds });
    self.postMessage({ kind: "complete" });
}

// ── PCM → WAV (legacy only) ──────────────────────────────────
function PCM2WAV(buffer, sampleRate, numChannels) {
    const view = new DataView(new ArrayBuffer(buffer.length * 2 + 44));
    view.setUint32(0,  0x46464952, true);
    view.setUint32(4,  view.buffer.byteLength - 8, true);
    view.setUint32(8,  0x45564157, true);
    view.setUint32(12, 0x20746d66, true);
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, numChannels * 2 * sampleRate, true);
    view.setUint16(32, numChannels * 2, true);
    view.setUint16(34, 16, true);
    view.setUint32(36, 0x61746164, true);
    view.setUint32(40, buffer.length * 2, true);
    let p = 44;
    for (let i = 0; i < buffer.length; i++) {
        const v = buffer[i];
        view.setInt16(p, v >= 1 ? 0x7fff : v <= -1 ? -0x8000 : (v * 0x8000) | 0, true);
        p += 2;
    }
    return { wavBuffer: view.buffer, duration: buffer.length / (sampleRate * numChannels) };
}
