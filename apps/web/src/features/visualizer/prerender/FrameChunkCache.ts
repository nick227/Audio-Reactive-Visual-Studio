import type { PrerenderChunk } from './chunks'
import type { RenderChunkIdentity } from './fingerprint'

export type CachedChunkStats = {
  readonly preparedChunks: number
  readonly totalChunks: number
  readonly cachedFrames: number
}

type CachedChunk = {
  readonly identity: RenderChunkIdentity
  readonly chunk: PrerenderChunk
  readonly totalFrames: number
  readonly frames: Map<number, ImageBitmap>
  touchedAt: number
}

export class FrameChunkCache {
  private readonly chunks = new Map<string, CachedChunk>()

  constructor(
    private readonly maxChunks = 12,
    private readonly maxFrames = 720,
  ) {}

  clear(): void {
    for (const chunk of this.chunks.values()) {
      for (const frame of chunk.frames.values()) frame.close()
    }
    this.chunks.clear()
  }

  invalidateMissing(validKeys: ReadonlySet<string>): void {
    for (const [key, chunk] of this.chunks) {
      if (validKeys.has(key)) continue
      for (const frame of chunk.frames.values()) frame.close()
      this.chunks.delete(key)
    }
  }

  getFrame(identity: RenderChunkIdentity, frameIndex: number): ImageBitmap | null {
    const chunk = this.chunks.get(identity.key)
    if (!chunk) return null
    const frame = chunk.frames.get(frameIndex)
    if (!frame) return null
    chunk.touchedAt = performance.now()
    return frame
  }

  putFrame(identity: RenderChunkIdentity, chunk: PrerenderChunk, frameIndex: number, totalFrames: number, frame: ImageBitmap): void {
    let entry = this.chunks.get(identity.key)
    if (!entry) {
      entry = {
        identity,
        chunk,
        totalFrames,
        frames: new Map(),
        touchedAt: performance.now(),
      }
      this.chunks.set(identity.key, entry)
    }

    const old = entry.frames.get(frameIndex)
    if (old) old.close()
    entry.frames.set(frameIndex, frame)
    entry.touchedAt = performance.now()
    this.evictOverflow()
  }

  isChunkPrepared(identity: RenderChunkIdentity): boolean {
    const chunk = this.chunks.get(identity.key)
    return Boolean(chunk && chunk.frames.size >= chunk.totalFrames)
  }

  stats(totalChunks: number, identities?: Iterable<RenderChunkIdentity>): CachedChunkStats {
    let preparedChunks = 0
    let cachedFrames = 0
    const keys = identities ? new Set(Array.from(identities, (identity) => identity.key)) : null
    for (const [key, chunk] of this.chunks) {
      if (keys && !keys.has(key)) continue
      cachedFrames += chunk.frames.size
      if (chunk.frames.size >= chunk.totalFrames) preparedChunks++
    }
    return { preparedChunks, totalChunks, cachedFrames }
  }

  private evictOverflow(): void {
    while (this.chunks.size > this.maxChunks || this.frameCount() > this.maxFrames) {
      let oldestKey: string | null = null
      let oldestTouched = Number.POSITIVE_INFINITY
      for (const [key, chunk] of this.chunks) {
        if (chunk.touchedAt < oldestTouched) {
          oldestTouched = chunk.touchedAt
          oldestKey = key
        }
      }
      if (!oldestKey) return
      const oldest = this.chunks.get(oldestKey)
      if (oldest) {
        for (const frame of oldest.frames.values()) frame.close()
        this.chunks.delete(oldestKey)
      }
    }
  }

  private frameCount(): number {
    let count = 0
    for (const chunk of this.chunks.values()) count += chunk.frames.size
    return count
  }
}
