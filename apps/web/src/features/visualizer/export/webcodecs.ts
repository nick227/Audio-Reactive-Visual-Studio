import { Muxer, ArrayBufferTarget } from 'webm-muxer'

export const WEBCODECS_SUPPORTED =
  typeof VideoEncoder !== 'undefined' &&
  typeof VideoFrame !== 'undefined'

export const AUDIO_ENCODER_SUPPORTED =
  typeof AudioEncoder !== 'undefined' &&
  typeof AudioData !== 'undefined'

// ── AV1 codec probe ───────────────────────────────────────────────────────────

let _av1Cache: boolean | null = null

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

type AudioChunk = { chunk: EncodedAudioChunk; meta: EncodedAudioChunkMetadata | undefined }

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
    output: (chunk, meta) => output.push({ chunk, meta }),
    error: (e) => { encodeError = e },
  })

  encoder.configure({ codec: 'opus', sampleRate, numberOfChannels, bitrate: 192_000 })

  try {
    for (let offset = 0; offset < totalFrames; offset += AUDIO_CHUNK_FRAMES) {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
      if (encodeError) throw encodeError

      // Yield every ~1.4 s so AbortSignal can be checked between browser tasks.
      if (offset > 0 && offset % (AUDIO_CHUNK_FRAMES * 16) === 0) {
        await new Promise<void>((r) => setTimeout(r, 0))
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

    await encoder.flush()
    if (encodeError) throw encodeError
  } finally {
    if (encoder.state !== 'closed') encoder.close()
  }

  return output
}

export interface FrameStats {
  frame: number
  totalFrames: number
  msPerFrame: number
  etaSec: number
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
  signal: AbortSignal
  renderFrame: (timeMs: number) => Promise<void>
  /**
   * 'vp9' (default) — fast, well-supported VP9 software encoding.
   * 'auto' — probe for AV1; use it if available (can be very slow without hardware encoder).
   */
  videoCodec?: 'vp9' | 'auto'
}

export interface WebCodecsExportResult {
  blob: Blob
  videoCodec: 'av1' | 'vp9'
  audioCodec: 'opus' | null
}

export async function exportVideoWebCodecs(opts: WebCodecsExportOptions): Promise<WebCodecsExportResult> {
  const { canvas, fps, durationMs, bitrate, audioUrl, onProgress, onFrameStats, signal, renderFrame } = opts

  const totalFrames = Math.ceil((durationMs / 1000) * fps)
  const frameDurationUs = Math.round(1_000_000 / fps)

  // Pre-encode audio before creating the muxer: we need to know definitively
  // whether audio muxing succeeds before declaring an audio track, since webm-muxer
  // requires track config at construction time.
  let audioChunks: AudioChunk[] | null = null
  let audioConfig: { numberOfChannels: number; sampleRate: number } | null = null

  if (audioUrl && AUDIO_ENCODER_SUPPORTED && !signal.aborted) {
    try {
      const audioBuf = await fetchAndResampleAudio(audioUrl)
      audioChunks = await encodeAudioBuffer(audioBuf, signal, durationMs)
      audioConfig = { numberOfChannels: audioBuf.numberOfChannels, sampleRate: audioBuf.sampleRate }
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
  const useAv1 = opts.videoCodec === 'auto' && await probeAv1(canvas.width, canvas.height, bitrate, fps)
  const videoEncoderCodec = useAv1 ? 'av01.0.09M.08' : 'vp09.00.41.08'
  const videoMuxerCodec   = useAv1 ? 'V_AV1' as const : 'V_VP9' as const

  const target = new ArrayBufferTarget()
  const muxer = new Muxer({
    target,
    video: { codec: videoMuxerCodec, width: canvas.width, height: canvas.height, frameRate: fps },
    ...(audioConfig ? { audio: { codec: 'A_OPUS', ...audioConfig } } : {}),
    firstTimestampBehavior: 'strict',
  })

  let encodeError: unknown = null
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
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
  const encodingStart = performance.now()
  console.group(
    `[AVL Export] ${totalFrames}f · ${fps}fps · ${useAv1 ? 'AV1' : 'VP9'} · ${canvas.width}×${canvas.height} · ${audioChunks ? 'Opus audio' : 'no audio'}`,
  )

  try {
    for (let i = 0; i < totalFrames; i++) {
      if (signal.aborted) throw new DOMException('Export cancelled', 'AbortError')
      if (encodeError) throw encodeError

      const timeMs = (i / fps) * 1000
      const timestampUs = i * frameDurationUs

      const t0 = performance.now()
      await renderFrame(timeMs)

      if (signal.aborted) throw new DOMException('Export cancelled', 'AbortError')

      const frame = new VideoFrame(canvas, { timestamp: timestampUs, duration: frameDurationUs })
      encoder.encode(frame, { keyFrame: i === 0 || i % (fps * 2) === 0 })
      frame.close()

      // Interleave audio chunks up to the start of the next video frame so
      // the muxer receives chunks in timestamp order, which ensures correct
      // Cues (seek table) generation and good compatibility with Chrome/VLC.
      if (audioChunks) {
        const nextVideoTs = (i + 1) * frameDurationUs
        while (
          audioIdx < audioChunks.length &&
          audioChunks[audioIdx].chunk.timestamp < nextVideoTs
        ) {
          const { chunk, meta } = audioChunks[audioIdx++]
          muxer.addAudioChunk(chunk, meta)
        }
      }

      const frameMs = performance.now() - t0
      frameTimings.push(frameMs)
      if (frameTimings.length > 30) frameTimings.shift()
      const avgMs = frameTimings.reduce((a, b) => a + b, 0) / frameTimings.length
      const etaSec = Math.round(avgMs * (totalFrames - i - 1) / 1000)

      if (i < 3 || i % 30 === 0) {
        console.log(`Frame ${i + 1}/${totalFrames} · ${avgMs.toFixed(0)} ms/f · ETA ${etaSec}s`)
      }
      if (onFrameStats) {
        onFrameStats({ frame: i + 1, totalFrames, msPerFrame: avgMs, etaSec })
      }

      onProgress((i + 1) / totalFrames)
      // Yield to the browser every 10 frames to allow AbortSignal checks and
      // UI repaints. Yielding every frame adds 3000+ macrotask boundaries for a
      // 2-minute export and visibly degrades performance.
      if (i % 10 === 9) await new Promise<void>((r) => setTimeout(r, 0))
    }

    await encoder.flush()
    if (encodeError) throw encodeError

    const totalSec = (performance.now() - encodingStart) / 1000
    console.log(
      `Done — ${totalSec.toFixed(1)}s total · avg ${(totalSec * 1000 / totalFrames).toFixed(0)} ms/f`,
    )
  } finally {
    console.groupEnd()
    if (encoder.state !== 'closed') encoder.close()
  }

  // Flush any audio chunks that fall after the last video frame.
  if (audioChunks) {
    for (; audioIdx < audioChunks.length; audioIdx++) {
      const { chunk, meta } = audioChunks[audioIdx]
      muxer.addAudioChunk(chunk, meta)
    }
  }

  muxer.finalize()
  return {
    blob: new Blob([target.buffer], { type: 'video/webm' }),
    videoCodec: useAv1 ? 'av1' : 'vp9',
    audioCodec: audioChunks ? 'opus' : null,
  }
}
