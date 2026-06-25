import { chunkIndexAtTime, type PrerenderChunk } from './chunks'

export type PrerenderQueueItem = {
  readonly chunk: PrerenderChunk
  readonly priority: number
}

export function prioritizeDirtyChunks(
  chunks: readonly PrerenderChunk[],
  dirtyIndexes: ReadonlySet<number>,
  currentTimeMs: number,
  durationMs: number,
): PrerenderQueueItem[] {
  const currentIndex = chunkIndexAtTime(currentTimeMs, durationMs)
  const byIndex = new Map(chunks.map((chunk) => [chunk.index, chunk]))
  const nearby = new Set<number>()
  for (let i = currentIndex; i <= currentIndex + 5; i++) nearby.add(i)
  for (let i = currentIndex - 2; i < currentIndex; i++) nearby.add(i)

  const queue: PrerenderQueueItem[] = []
  for (const index of dirtyIndexes) {
    const chunk = byIndex.get(index)
    if (!chunk) continue
    const distance = Math.abs(index - currentIndex)
    const priority = index === currentIndex ? 0 : nearby.has(index) ? 10 + distance : 100 + distance
    queue.push({ chunk, priority })
  }
  return queue.sort((a, b) => a.priority - b.priority || a.chunk.index - b.chunk.index)
}

export function scheduleIdleTask(callback: () => void, timeout = 1_000): () => void {
  const idleWindow = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
    cancelIdleCallback?: (id: number) => void
  }
  if (idleWindow.requestIdleCallback && idleWindow.cancelIdleCallback) {
    const id = idleWindow.requestIdleCallback(callback, { timeout })
    return () => idleWindow.cancelIdleCallback?.(id)
  }
  const id = window.setTimeout(callback, 80)
  return () => window.clearTimeout(id)
}
