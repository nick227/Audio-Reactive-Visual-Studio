import { Muxer, ArrayBufferTarget } from 'webm-muxer'
import type { ExportVideoCodec } from './presets'

export const WEBCODECS_SUPPORTED =
  typeof VideoEncoder !== 'undefined' &&
  typeof VideoFrame !== 'undefined'

export const AUDIO_ENCODER_SUPPORTED =
  typeof AudioEncoder !== 'undefined' &&
  typeof AudioData !== 'undefined'

// ── AV1 codec probe ───────────────────────────────────────────────────────────

let _av1Cache: boolean | null = null
let _vp8Cache: boolean | null = null

/** Probe once whether AV1 encoding is available for the given config. Cached. */
export async function probeAv1(
  width: number,
  height: number,
  bitrate: number,
  framerate: number,
): Promise<boolean> {
  if (!WEBCODECS_SUPPORTED) return false
  if (typeof VideoEncoder.isConfigSupported !== 'function') return false
  if (_av1Cache !== null) return _av1Cache
  try {
    const r = await VideoEncoder.isConfigSupported({
      codec: 'av01.0.09M.08', // AV1 Main profile, level 4.1, 8-bit
      width,
      height,
      bitrate,
      framerate,
      latencyMode: 'quality',
    })
    _av1Cache = r.supported === true
  } catch {
    _av1Cache = false
  }
  return _av1Cache
}

/** Probe once whether VP8 encoding is available for the given config. Cached. */
export async function probeVp8(
  width: number,
  height: number,
  bitrate: number,
  framerate: number,
): Promise<boolean> {
  if (!WEBCODECS_SUPPORTED) return false
  if (typeof VideoEncoder.isConfigSupported !== 'function') return true
  if (_vp8Cache !== null) return _vp8Cache
  try {
    const r = await VideoEncoder.isConfigSupported({
      codec: 'vp8',
      width,
      height,
      bitrate,
      framerate,
      latencyMode: 'realtime',
    })
    _vp8Cache = r.supported === true
  } catch {
    _vp8Cache = false
  }
  return _vp8Cache
}

// Opus requires one of: 8000, 12000, 16000, 24000, 48000 Hz.
const OPUS_SAMPLE_RATE = 48_000
// ~85 ms per chunk at 48 kHz.
const AUDIO_CHUNK_FRAMES = 4_096

async function fetchAndResampleAudio(url: string): Promise<AudioBuffer> {
  const resp = await fetch(url)
  const arrayBuffer = await resp.arrayBuffer()

  // OfflineAudioContext.decodeAudioData returns the source file's native rate
  // regardless of the context rate, so we use a minimal throw-away context here.
  const decodeCtx = new OfflineAudioContext(1, 1, OPUS_SAMPLE_RATE)
  const native = await decodeCtx.decodeAudioData(arrayBuffer)

  if (native.sampleRate === OPUS_SAMPLE_RATE) return native

  // Resample to 48 kHz so Opus accepts it.
  const channels = native.numberOfChannels
  const frames = Math.ceil(native.duration * OPUS_SAMPLE_RATE)
  const offCtx = new OfflineAudioContext(channels, frames, OPUS_SAMPLE_RATE)
  const src = offCtx.createBufferSource()
  src.buffer = native
  src.connect(offCtx.destination)
  src.start(0)
  return offCtx.startRendering()
}

type AudioChunk = { chunk: EncodedAudioChunk; meta: EncodedAudioChunkMetadata | undefined; timestamp: number }

export type WebCodecsExportPhase =
  | 'encoding-frames'
  | 'flushing-video'
  | 'muxing-audio'
  | 'finalizing-webm'
  | 'creating-blob'
  | 'complete'

const VIDEO_FLUSH_TIMEOUT_MS = 60_000
const VIDEO_QUEUE_POLL_MS = 8

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new DOMException('Export cancelled', 'AbortError')
}

async function withAbortableTimeout<T>(
  promise: Promise<T>,
  label: string,
  signal: AbortSignal,
  timeoutMs = VIDEO_FLUSH_TIMEOUT_MS,
): Promise<T> {
  throwIfAborted(signal)

  return new Promise<T>((resolve, reject) => {
    let done = false
    const finish = (fn: () => void) => {
      if (done) return
      done = true
      clearTimeout(timeout)
      signal.removeEventListener('abort', onAbort)
      fn()
    }
    const onAbort = () => finish(() => reject(new DOMException('Export cancelled', 'AbortError')))
    const timeout = setTimeout(() => {
      finish(() => reject(new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)}s`)))
    }, timeoutMs)

    signal.addEventListener('abort', onAbort, { once: true })
    promise.then(
      (value) => finish(() => resolve(value)),
      (error) => finish(() => reject(error)),
    )
  })
}

async function waitForVideoEncoderBackpressure(
  encoder: VideoEncoder,
  signal: AbortSignal,
  getEncodeError: () => unknown,
  maxQueueSize: number,
): Promise<number> {
  const waitStart = performance.now()
  while (encoder.encodeQueueSize > maxQueueSize) {
    throwIfAborted(signal)
    const encodeError = getEncodeError()
    if (encodeError) throw encodeError
    await new Promise<void>((r) => setTimeout(r, VIDEO_QUEUE_POLL_MS))
  }
  return performance.now() - waitStart
}

async function encodeAudioBuffer(
  buf: AudioBuffer,
  signal: AbortSignal,
  durationMs: number,
): Promise<AudioChunk[]> {
  const { sampleRate, numberOfChannels } = buf
  // Clamp audio to export duration so the audio track never outlasts the video.
  const maxFrames = Math.ceil((durationMs / 1000) * sampleRate)
  const totalFrames = Math.min(buf.length, maxFrames)
  const output: AudioChunk[] = []
  let encodeError: unknown = null

  const encoder = new AudioEncoder({
    output: (chunk, meta) => output.push({ chunk, meta, timestamp: chunk.timestamp }),
    error: (e) => { encodeError = e },
  })

  encoder.configure({ codec: 'opus', sampleRate, numberOfChannels, bitrate: 192_000 })

  try {
    for (let offset = 0; offset < totalFrames; offset += AUDIO_CHUNK_FRAMES) {
      throwIfAborted(signal)
      if (encodeError) throw encodeError

      // Yield every ~1.4 s so AbortSignal can be checked between browser tasks.
      if (offset > 0 && offset % (AUDIO_CHUNK_FRAMES * 16) === 0) {
        await new Promise<void>((r) => setTimeout(r, 0))
        throwIfAborted(signal)
      }

      const frameCount = Math.min(AUDIO_CHUNK_FRAMES, totalFrames - offset)
      // f32-planar: channel-0 samples, then channel-1 samples, …
      const data = new Float32Array(frameCount * numberOfChannels)
      for (let ch = 0; ch < numberOfChannels; ch++) {
        data.set(buf.getChannelData(ch).subarray(offset, offset + frameCount), ch * frameCount)
      }

      const audioData = new AudioData({
        format: 'f32-planar',
        sampleRate,
        numberOfFrames: frameCount,
        numberOfChannels,
        timestamp: Math.round((offset / sampleRate) * 1_000_000),
        data,
      })
      encoder.encode(audioData)
      audioData.close()
    }

    await withAbortableTimeout(encoder.flush(), '[AVL Export] audio flush', signal)
    if (encodeError) throw encodeError
  } finally {
    try {
      if (encoder.state !== 'closed') encoder.close()
    } catch (closeError) {
      console.warn('[AVL Export] audio encoder close failed', closeError)
    }
  }

  return output
}

function normalizeAndValidateAudioChunks(chunks: AudioChunk[], expectedDurationUs: number): void {
  if (chunks.length === 0) return

  const firstTimestamp = chunks[0].chunk.timestamp
  let lastTimestamp = -1
  for (const item of chunks) {
    const rawTimestamp = item.chunk.timestamp
    if (!Number.isFinite(rawTimestamp)) {
      throw new Error(`Audio chunk has a non-finite timestamp: ${rawTimestamp}`)
    }
    if (rawTimestamp < lastTimestamp) {
      throw new Error(`Audio chunk timestamps are not monotonic: ${lastTimestamp} -> ${rawTimestamp}`)
    }
    const timestamp = rawTimestamp - firstTimestamp
    if (!Number.isFinite(timestamp)) {
      throw new Error(`Audio chunk has a non-finite timestamp: ${timestamp}`)
    }
    if (timestamp < 0) {
      throw new Error(`Audio chunk has a negative timestamp: ${timestamp}`)
    }
    if (timestamp > expectedDurationUs) {
      throw new Error(`Audio chunk timestamp ${timestamp} exceeds export duration ${expectedDurationUs}`)
    }
    item.timestamp = timestamp
    lastTimestamp = rawTimestamp
  }
}

export interface FrameStats {
  frame: number
  totalFrames: number
  msPerFrame: number
  etaSec: number
  encodedFps: number
  realtimeFactor: number
  queueWaitMsPerFrame: number
  encodeWaitMsPerFrame: number
}

export interface WebCodecsExportOptions {
  canvas: HTMLCanvasElement
  fps: number
  durationMs: number
  bitrate: number
  /** Object URL of the project audio. Omit for video-only. */
  audioUrl?: string
  onProgress: (progress: number) => void
  /** Called every 10 frames with rolling-average timing and ETA. */
  onFrameStats?: (stats: FrameStats) => void
  onPhase?: (phase: WebCodecsExportPhase) => void
  signal: AbortSignal
  renderFrame: (timeMs: number) => Promise<void>
  /** Temporary diagnostic path: skip Opus encode/mux to isolate mux/audio hangs. */
  videoOnly?: boolean
  /**
   * 'vp9' (default) — fast, well-supported VP9 software encoding.
   * 'auto' — probe for AV1; use it if available (can be very slow without hardware encoder).
   */
  videoCodec?: ExportVideoCodec
  maxVideoEncodeQueueSize?: number
}

export interface WebCodecsExportResult {
  blob: Blob
  videoCodec: 'av1' | 'vp8' | 'vp9'
  audioCodec: 'opus' | null
}

export async function exportVideoWebCodecs(opts: WebCodecsExportOptions): Promise<WebCodecsExportResult> {
  const { canvas, fps, durationMs, bitrate, audioUrl, onProgress, onFrameStats, onPhase, signal, renderFrame } = opts

  const totalFrames = Math.ceil((durationMs / 1000) * fps)
  const frameDurationUs = Math.round(1_000_000 / fps)
  const expectedVideoDurationUs = totalFrames * frameDurationUs
  const maxVideoEncodeQueueSize = opts.maxVideoEncodeQueueSize ?? 12
  const forceVideoOnly = opts.videoOnly || (() => {
    try {
      return globalThis.localStorage?.getItem('avl-export-video-only') === '1'
    } catch {
      return false
    }
  })()

  // Pre-encode audio before creating the muxer: we need to know definitively
  // whether audio muxing succeeds before declaring an audio track, since webm-muxer
  // requires track config at construction time.
  let audioChunks: AudioChunk[] | null = null
  let audioConfig: { numberOfChannels: number; sampleRate: number } | null = null

  if (!forceVideoOnly && audioUrl && AUDIO_ENCODER_SUPPORTED && !signal.aborted) {
    try {
      const audioBuf = await fetchAndResampleAudio(audioUrl)
      audioChunks = await encodeAudioBuffer(audioBuf, signal, durationMs)
      normalizeAndValidateAudioChunks(audioChunks, expectedVideoDurationUs)
      if (audioChunks.length > 0) {
        audioConfig = { numberOfChannels: audioBuf.numberOfChannels, sampleRate: audioBuf.sampleRate }
      } else {
        audioChunks = null
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') throw e
      // Audio failed — fall through to video-only; don't abort the export.
      audioChunks = null
      audioConfig = null
    }
  }

  // Only attempt AV1 when explicitly requested — software AV1 encoding is
  // 10–50× slower than VP9 on CPU and hardware AV1 encoders are rare.
  // Default to VP9 which gives fast, high-quality output on every device.
  const requestedVideoCodec = opts.videoCodec ?? 'vp9'
  const useAv1 = requestedVideoCodec === 'auto' && await probeAv1(canvas.width, canvas.height, bitrate, fps)
  const useVp8 = requestedVideoCodec === 'vp8' && await probeVp8(canvas.width, canvas.height, bitrate, fps)
  const resolvedVideoCodec: 'av1' | 'vp8' | 'vp9' = useAv1 ? 'av1' : useVp8 ? 'vp8' : 'vp9'
  const videoEncoderCodec = resolvedVideoCodec === 'av1'
    ? 'av01.0.09M.08'
    : resolvedVideoCodec === 'vp8'
      ? 'vp8'
      : 'vp09.00.41.08'
  const videoMuxerCodec = resolvedVideoCodec === 'av1'
    ? 'V_AV1' as const
    : resolvedVideoCodec === 'vp8'
      ? 'V_VP8' as const
      : 'V_VP9' as const

  const target = new ArrayBufferTarget()
  const muxer = new Muxer({
    target,
    video: { codec: videoMuxerCodec, width: canvas.width, height: canvas.height, frameRate: fps },
    ...(audioConfig ? { audio: { codec: 'A_OPUS', ...audioConfig } } : {}),
    firstTimestampBehavior: 'strict',
  })

  let encodeError: unknown = null
  let encodedVideoChunks = 0
  let firstVideoTimestamp: number | null = null
  let lastVideoTimestamp: number | null = null
  let maxVideoQueueSize = 0
  let muxedAudioChunks = 0
  let firstAudioTimestamp: number | null = audioChunks?.[0]?.timestamp ?? null
  let lastAudioTimestamp: number | null = audioChunks?.[audioChunks.length - 1]?.timestamp ?? null

  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      try {
        encodedVideoChunks++
        firstVideoTimestamp ??= chunk.timestamp
        lastVideoTimestamp = chunk.timestamp
        muxer.addVideoChunk(chunk, meta)
      } catch (e) {
        encodeError = e
      }
    },
    error: (e) => { encodeError = e },
  })

  encoder.configure({
    codec: videoEncoderCodec,
    width: canvas.width,
    height: canvas.height,
    bitrate,
    framerate: fps,
    latencyMode: 'quality',
  })

  // Pointer into the pre-encoded audio chunk array for interleaving.
  let audioIdx = 0

  // Per-frame timing for diagnostics (rolling 30-frame window).
  const frameTimings: number[] = []
  let totalQueueWaitMs = 0
  let maxQueueWaitMs = 0
  const encodingStart = performance.now()
  onPhase?.('encoding-frames')
  console.group(
    `[AVL Export] ${totalFrames}f · ${fps}fps · ${resolvedVideoCodec.toUpperCase()} · ${canvas.width}×${canvas.height} · ${audioChunks ? 'Opus audio' : 'no audio'}`,
  )
  console.log('[AVL Export] diagnostics', {
    expectedVideoDurationUs,
    audioChunks: audioChunks?.length ?? 0,
    firstAudioTimestamp,
    lastAudioTimestamp,
    videoOnly: forceVideoOnly,
    requestedVideoCodec,
    resolvedVideoCodec,
    maxVideoEncodeQueueSize,
  })
  if (audioChunks) console.time('[AVL Export] audio mux')

  try {
    for (let i = 0; i < totalFrames; i++) {
      throwIfAborted(signal)
      if (encodeError) throw encodeError

      const timeMs = (i / fps) * 1000
      const timestampUs = i * frameDurationUs

      const t0 = performance.now()
      await renderFrame(timeMs)

      throwIfAborted(signal)

      const frame = new VideoFrame(canvas, { timestamp: timestampUs, duration: frameDurationUs })
      try {
        encoder.encode(frame, { keyFrame: i === 0 || i % (fps * 2) === 0 })
        maxVideoQueueSize = Math.max(maxVideoQueueSize, encoder.encodeQueueSize)
      } finally {
        frame.close()
      }

      const queueWaitMs = await waitForVideoEncoderBackpressure(
        encoder,
        signal,
        () => encodeError,
        maxVideoEncodeQueueSize,
      )
      totalQueueWaitMs += queueWaitMs
      maxQueueWaitMs = Math.max(maxQueueWaitMs, queueWaitMs)

      // Interleave audio chunks up to the start of the next video frame so
      // the muxer receives chunks in timestamp order, which ensures correct
      // Cues (seek table) generation and good compatibility with Chrome/VLC.
      if (audioChunks) {
        const nextVideoTs = (i + 1) * frameDurationUs
        while (
          audioIdx < audioChunks.length &&
          audioChunks[audioIdx].timestamp < nextVideoTs
        ) {
          const { chunk, meta, timestamp } = audioChunks[audioIdx++]
          muxer.addAudioChunk(chunk, meta, timestamp)
          muxedAudioChunks++
        }
      }

      const frameMs = performance.now() - t0
      frameTimings.push(frameMs)
      if (frameTimings.length > 30) frameTimings.shift()
      const avgMs = frameTimings.reduce((a, b) => a + b, 0) / frameTimings.length
      const etaSec = Math.round(avgMs * (totalFrames - i - 1) / 1000)
      const elapsedSec = Math.max((performance.now() - encodingStart) / 1000, 0.001)
      const mediaSec = (i + 1) / fps
      const encodedFps = (i + 1) / elapsedSec
      const realtimeFactor = mediaSec / elapsedSec
      const queueWaitMsPerFrame = totalQueueWaitMs / (i + 1)
      const encodeWaitMsPerFrame = Math.max(0, avgMs - queueWaitMsPerFrame)

      if (i < 3 || i % 30 === 0) {
        console.log(
          `Frame ${i + 1}/${totalFrames} · ${avgMs.toFixed(0)} ms/f · ${encodedFps.toFixed(1)} enc fps · ${realtimeFactor.toFixed(2)}× realtime · queue ${encoder.encodeQueueSize}`,
        )
      }
      if (onFrameStats) {
        onFrameStats({
          frame: i + 1,
          totalFrames,
          msPerFrame: avgMs,
          etaSec,
          encodedFps,
          realtimeFactor,
          queueWaitMsPerFrame,
          encodeWaitMsPerFrame,
        })
      }

      onProgress((i + 1) / totalFrames)
      // Yield to the browser every 10 frames to allow AbortSignal checks and
      // UI repaints. Yielding every frame adds 3000+ macrotask boundaries for a
      // 2-minute export and visibly degrades performance.
      if (i % 10 === 9) {
        await new Promise<void>((r) => setTimeout(r, 0))
        throwIfAborted(signal)
      }
    }

    onPhase?.('flushing-video')
    console.log('[AVL Export] final video queue before flush', {
      encodeQueueSize: encoder.encodeQueueSize,
      encodedVideoChunks,
      expectedVideoChunks: totalFrames,
      maxVideoQueueSize,
      maxQueueWaitMs,
    })
    console.time('[AVL Export] video flush')
    try {
      await withAbortableTimeout(encoder.flush(), '[AVL Export] video flush', signal)
    } finally {
      console.timeEnd('[AVL Export] video flush')
    }
    if (encodeError) throw encodeError

    const totalSec = (performance.now() - encodingStart) / 1000
    console.log(
      `Done — ${totalSec.toFixed(1)}s total · avg ${(totalSec * 1000 / totalFrames).toFixed(0)} ms/f`,
    )
  } finally {
    console.groupEnd()
    try {
      if (encoder.state !== 'closed') encoder.close()
    } catch (closeError) {
      console.warn('[AVL Export] video encoder close failed', closeError)
    }
  }

  // Flush any audio chunks that fall after the last video frame.
  if (audioChunks) {
    onPhase?.('muxing-audio')
    throwIfAborted(signal)
    for (; audioIdx < audioChunks.length; audioIdx++) {
      const { chunk, meta, timestamp } = audioChunks[audioIdx]
      muxer.addAudioChunk(chunk, meta, timestamp)
      muxedAudioChunks++
      if (audioIdx % 128 === 127) {
        await new Promise<void>((r) => setTimeout(r, 0))
        throwIfAborted(signal)
      }
    }
    console.timeEnd('[AVL Export] audio mux')
  }

  throwIfAborted(signal)
  onPhase?.('finalizing-webm')
  console.time('[AVL Export] mux finalize')
  muxer.finalize()
  console.timeEnd('[AVL Export] mux finalize')

  throwIfAborted(signal)
  onPhase?.('creating-blob')
  console.time('[AVL Export] blob')
  const blob = new Blob([target.buffer], { type: 'video/webm' })
  console.timeEnd('[AVL Export] blob')
  console.log('[AVL Export] final diagnostics', {
    encodedVideoChunks,
    muxedAudioChunks,
    totalAudioChunks: audioChunks?.length ?? 0,
    firstVideoTimestamp,
    lastVideoTimestamp,
    maxVideoQueueSize,
    maxQueueWaitMs,
    queueWaitMsPerFrame: totalQueueWaitMs / Math.max(totalFrames, 1),
    firstAudioTimestamp,
    lastAudioTimestamp,
    expectedVideoDurationUs,
    blobSize: blob.size,
  })
  onPhase?.('complete')

  return {
    blob,
    videoCodec: resolvedVideoCodec,
    audioCodec: audioChunks ? 'opus' : null,
  }
}
