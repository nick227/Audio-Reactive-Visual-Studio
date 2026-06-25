import { idbPut, idbGet } from '../storage/idbStorage'

const CACHE_VERSION = 1
const PEAK_RESOLUTION = 512

export interface AudioAnalysisResult {
  readonly fps: number
  readonly durationMs: number
  readonly sampleRate: number
  /** 512-point waveform peaks, normalized 0–1, for display. */
  readonly peaks: Float32Array
  /** Per-frame RMS amplitude, normalized 0–1. */
  readonly rmsPerFrame: Float32Array
  /** Per-frame low-frequency energy proxy (100 ms window RMS), normalized 0–1.
   *  Placeholder — will be replaced with FFT-based analysis in Phase 3. */
  readonly bassPerFrame: Float32Array
  /** Per-frame onset strength (positive RMS derivative), normalized 0–1.
   *  Placeholder — will be replaced with spectral-flux onset detection in Phase 3. */
  readonly transientsPerFrame: Float32Array
}

// ── Simple non-cryptographic URL fingerprint ─────────────────────────────────

function djb2(str: string): string {
  let h = 5381
  for (let i = 0; i < str.length; i++) {
    h = (((h << 5) + h) ^ str.charCodeAt(i)) >>> 0
  }
  return h.toString(36)
}

// ── Analysis computation ──────────────────────────────────────────────────────

function normalizeInPlace(arr: Float32Array): void {
  let max = 0
  for (let i = 0; i < arr.length; i++) if (arr[i] > max) max = arr[i]
  if (max > 0) for (let i = 0; i < arr.length; i++) arr[i] /= max
}

export function analyzeAudioBuffer(
  buf: AudioBuffer,
  fps: number,
  durationMs: number,
): AudioAnalysisResult {
  const { sampleRate, numberOfChannels, length } = buf
  const frameCount = Math.ceil((durationMs / 1000) * fps)
  const samplesPerFrame = sampleRate / fps
  // 100 ms centered window for bass proxy.
  const bassHalf = Math.round(sampleRate * 0.05)

  // Mix down to mono.
  const mono = new Float32Array(length)
  for (let ch = 0; ch < numberOfChannels; ch++) {
    const chData = buf.getChannelData(ch)
    const scale = 1 / numberOfChannels
    for (let i = 0; i < length; i++) mono[i] += chData[i] * scale
  }

  const rmsPerFrame = new Float32Array(frameCount)
  const bassPerFrame = new Float32Array(frameCount)

  for (let f = 0; f < frameCount; f++) {
    const start = Math.min(Math.round(f * samplesPerFrame), length)
    const end   = Math.min(Math.round((f + 1) * samplesPerFrame), length)
    const n = end - start

    // Per-frame RMS.
    let sumSq = 0
    for (let i = start; i < end; i++) sumSq += mono[i] * mono[i]
    rmsPerFrame[f] = n > 0 ? Math.sqrt(sumSq / n) : 0

    // Bass proxy: longer centered window RMS.
    const bStart = Math.max(0, start - bassHalf)
    const bEnd   = Math.min(length, end + bassHalf)
    const bn = bEnd - bStart
    let bSumSq = 0
    for (let i = bStart; i < bEnd; i++) bSumSq += mono[i] * mono[i]
    bassPerFrame[f] = bn > 0 ? Math.sqrt(bSumSq / bn) : 0
  }

  // Transients: positive first derivative of RMS.
  const transientsPerFrame = new Float32Array(frameCount)
  for (let f = 1; f < frameCount; f++) {
    transientsPerFrame[f] = Math.max(0, rmsPerFrame[f] - rmsPerFrame[f - 1])
  }

  normalizeInPlace(rmsPerFrame)
  normalizeInPlace(bassPerFrame)
  normalizeInPlace(transientsPerFrame)

  // Waveform peaks.
  const peaks = new Float32Array(PEAK_RESOLUTION)
  const bucket = Math.ceil(length / PEAK_RESOLUTION)
  for (let p = 0; p < PEAK_RESOLUTION; p++) {
    const s = p * bucket
    let peak = 0
    for (let i = s; i < Math.min(s + bucket, length); i++) {
      const abs = Math.abs(mono[i])
      if (abs > peak) peak = abs
    }
    peaks[p] = peak
  }

  return { fps, durationMs, sampleRate, peaks, rmsPerFrame, bassPerFrame, transientsPerFrame }
}

// ── IDB-backed cache ──────────────────────────────────────────────────────────

function idbKey(fingerprint: string, fps: number): string {
  return `avl-audio-analysis-v${CACHE_VERSION}-${fingerprint}-fps${fps}`
}

async function writeCache(key: string, r: AudioAnalysisResult): Promise<void> {
  const payload = {
    v: CACHE_VERSION,
    fps: r.fps,
    durationMs: r.durationMs,
    sampleRate: r.sampleRate,
    peaks: Array.from(r.peaks),
    rmsPerFrame: Array.from(r.rmsPerFrame),
    bassPerFrame: Array.from(r.bassPerFrame),
    transientsPerFrame: Array.from(r.transientsPerFrame),
  }
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })
  await idbPut(key, blob)
}

async function readCache(key: string): Promise<AudioAnalysisResult | null> {
  const blob = await idbGet(key)
  if (!blob) return null
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = JSON.parse(await blob.text()) as any
    if (p.v !== CACHE_VERSION) return null
    return {
      fps: p.fps,
      durationMs: p.durationMs,
      sampleRate: p.sampleRate,
      peaks: new Float32Array(p.peaks),
      rmsPerFrame: new Float32Array(p.rmsPerFrame),
      bassPerFrame: new Float32Array(p.bassPerFrame),
      transientsPerFrame: new Float32Array(p.transientsPerFrame),
    }
  } catch {
    return null
  }
}

// ── Spectrum approximation (for export canvas renderer) ──────────────────────

/**
 * Derives a plausible per-bin frequency spectrum from existing per-frame data —
 * no FFT required. The result reacts to the music in a musically meaningful way
 * and makes audioVisualizer layers look correct in export renders.
 *
 * @param numBins Number of frequency bins (matches the layer's bar count).
 */
export function approximateSpectrumAt(
  analysis: AudioAnalysisResult,
  frameIdx: number,
  numBins: number,
): Float32Array {
  const last = analysis.rmsPerFrame.length - 1
  const idx  = Math.min(last, Math.max(0, frameIdx))
  const bass = analysis.bassPerFrame[idx]         ?? 0
  const rms  = analysis.rmsPerFrame[idx]          ?? 0
  const trns = analysis.transientsPerFrame[idx]   ?? 0

  const spectrum = new Float32Array(numBins)
  for (let i = 0; i < numBins; i++) {
    const t = i / numBins                                           // 0=low 1=high
    const bassEnv = bass * Math.exp(-t * 3.5)
    const midEnv  = rms  * 0.65 * Math.exp(-(((t - 0.25) * 4) ** 2))
    const hiEnv   = trns * 0.45 * Math.exp(-(((t - 0.65) * 4) ** 2))
    const floor   = rms  * 0.12 * (1 - t * 0.5)
    spectrum[i] = Math.min(1, bassEnv + midEnv + hiEnv + floor)
  }
  return spectrum
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getOrComputeAnalysis(
  audioUrl: string,
  fileKey: string | undefined,
  fps: number,
  durationMs: number,
  signal: AbortSignal,
): Promise<AudioAnalysisResult | null> {
  const fingerprint = fileKey ?? djb2(audioUrl)
  const key = idbKey(fingerprint, fps)

  const cached = await readCache(key)
  if (cached) return cached

  if (signal.aborted) throw new DOMException('Aborted', 'AbortError')

  let audioBuffer: AudioBuffer
  try {
    const resp = await fetch(audioUrl, { signal })
    const arrayBuffer = await resp.arrayBuffer()
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
    // Decode at native rate — we only need raw samples for analysis.
    const ctx = new OfflineAudioContext(1, 1, 44_100)
    audioBuffer = await ctx.decodeAudioData(arrayBuffer)
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e
    return null
  }

  if (signal.aborted) throw new DOMException('Aborted', 'AbortError')

  const result = analyzeAudioBuffer(audioBuffer, fps, durationMs)

  // Write cache in the background; don't block export on cache write failures.
  writeCache(key, result).catch(() => {})

  return result
}
