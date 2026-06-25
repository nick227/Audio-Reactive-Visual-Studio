export const PRERENDER_CHUNK_MS = 2_000

export type PrerenderChunk = {
  readonly index: number
  readonly startMs: number
  readonly endMs: number
}

export function buildPrerenderChunks(durationMs: number, chunkMs = PRERENDER_CHUNK_MS): PrerenderChunk[] {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return []
  const count = Math.ceil(durationMs / chunkMs)
  return Array.from({ length: count }, (_, index) => {
    const startMs = index * chunkMs
    return {
      index,
      startMs,
      endMs: Math.min(durationMs, startMs + chunkMs),
    }
  })
}

export function chunkIndexAtTime(timeMs: number, durationMs: number, chunkMs = PRERENDER_CHUNK_MS): number {
  if (durationMs <= 0) return 0
  const maxIndex = Math.max(0, Math.ceil(durationMs / chunkMs) - 1)
  return Math.max(0, Math.min(maxIndex, Math.floor(Math.max(0, timeMs) / chunkMs)))
}

export function chunkFrameRange(chunk: PrerenderChunk, fps: number, durationMs: number): { startFrame: number; endFrame: number } {
  const totalFrames = Math.ceil((durationMs / 1000) * fps)
  const startFrame = Math.max(0, Math.floor((chunk.startMs / 1000) * fps))
  const endFrame = Math.min(totalFrames, Math.ceil((chunk.endMs / 1000) * fps))
  return { startFrame, endFrame }
}

export function frameTimeMs(frameIndex: number, fps: number): number {
  return (frameIndex / fps) * 1000
}
