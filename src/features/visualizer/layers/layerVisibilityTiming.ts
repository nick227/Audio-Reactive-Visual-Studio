import { createEntityId } from '../entities/entityTypes'
import type { LayerInstance, LayerTiming, LayerVisibilityGap } from '../project/types'
import { DEFAULT_LAYER_TIMING } from '../project/types'

export const MOVE_THRESHOLD_PX = 8
export const EDGE_THRESHOLD_PX = 10
export const MIN_GAP_MS = 400
const IDEAL_GAP_RATIO = 0.08
const MIN_CREATE_MS = 1500
const MAX_CREATE_MS = 8000

export function isDurationKnown(durationMs: number): boolean {
  return durationMs > 0
}

export function layerTiming(layer: LayerInstance): LayerTiming {
  return layer.timing ?? DEFAULT_LAYER_TIMING
}

export function isLayerVisibleAtTime(
  layer: LayerInstance,
  currentTimeMs: number,
  durationMs = 0,
): boolean {
  if (!layer.visible) return false
  if (!isDurationKnown(durationMs)) return true
  const timing = layerTiming(layer)
  if (timing.mode === 'always') return true
  return timing.gaps.some((gap) => currentTimeMs >= gap.startMs && currentTimeMs <= gap.endMs)
}

export function msToX(ms: number, width: number, durationMs: number): number {
  if (durationMs <= 0) return 0
  return (ms / durationMs) * width
}

export function xToMs(x: number, width: number, durationMs: number): number {
  if (width <= 0) return 0
  return Math.max(0, Math.min(durationMs, (x / width) * durationMs))
}

export function idealGapDuration(durationMs: number): number {
  if (durationMs <= 0) return MIN_CREATE_MS
  return Math.max(MIN_CREATE_MS, Math.min(MAX_CREATE_MS, durationMs * IDEAL_GAP_RATIO))
}

export function normalizeGaps(gaps: LayerVisibilityGap[], durationMs: number): LayerVisibilityGap[] {
  if (durationMs <= 0) return []
  const sorted = [...gaps]
    .map((gap) => ({
      ...gap,
      startMs: Math.max(0, Math.min(durationMs, gap.startMs)),
      endMs: Math.max(0, Math.min(durationMs, gap.endMs)),
    }))
    .filter((gap) => gap.endMs > gap.startMs)
    .sort((a, b) => a.startMs - b.startMs)

  const result: LayerVisibilityGap[] = []
  for (const gap of sorted) {
    let startMs = gap.startMs
    let endMs = gap.endMs
    if (endMs - startMs < MIN_GAP_MS) endMs = Math.min(durationMs, startMs + MIN_GAP_MS)
    if (endMs - startMs < MIN_GAP_MS) startMs = Math.max(0, endMs - MIN_GAP_MS)
    if (endMs - startMs < MIN_GAP_MS) continue

    const prev = result[result.length - 1]
    if (prev && startMs < prev.endMs) startMs = prev.endMs
    if (endMs - startMs < MIN_GAP_MS) continue
    if (startMs >= durationMs) continue

    result.push({ ...gap, startMs, endMs: Math.min(durationMs, endMs) })
  }
  return result
}

export function convertAlwaysAt(clickMs: number, durationMs: number): LayerTiming {
  const gap: LayerVisibilityGap = {
    id: createEntityId('vgap'),
    startMs: 0,
    endMs: Math.max(MIN_GAP_MS, clickMs),
  }
  return { mode: 'gaps', gaps: normalizeGaps([gap], durationMs) }
}

export function trimGapAt(
  gaps: LayerVisibilityGap[],
  gapId: string,
  clickMs: number,
  durationMs: number,
): LayerVisibilityGap[] {
  return normalizeGaps(
    gaps.map((gap) => {
      if (gap.id !== gapId) return gap
      const distStart = Math.abs(clickMs - gap.startMs)
      const distEnd = Math.abs(gap.endMs - clickMs)
      if (distStart <= distEnd) {
        const startMs = Math.min(clickMs, gap.endMs - MIN_GAP_MS)
        return { ...gap, startMs: Math.max(0, startMs) }
      }
      const endMs = Math.max(clickMs, gap.startMs + MIN_GAP_MS)
      return { ...gap, endMs: Math.min(durationMs, endMs) }
    }),
    durationMs,
  )
}

export function moveGap(
  gaps: LayerVisibilityGap[],
  gapId: string,
  deltaMs: number,
  durationMs: number,
): LayerVisibilityGap[] {
  const sorted = normalizeGaps(gaps, durationMs)
  const idx = sorted.findIndex((g) => g.id === gapId)
  if (idx < 0) return sorted

  const gap = sorted[idx]
  const len = gap.endMs - gap.startMs
  const prevEnd = idx > 0 ? sorted[idx - 1].endMs : 0
  const nextStart = idx < sorted.length - 1 ? sorted[idx + 1].startMs : durationMs

  let startMs = gap.startMs + deltaMs
  startMs = Math.max(prevEnd, Math.min(nextStart - len, startMs))
  const endMs = startMs + len

  return normalizeGaps(
    sorted.map((g) => (g.id === gapId ? { ...g, startMs, endMs } : g)),
    durationMs,
  )
}

export function resizeGapEdge(
  gaps: LayerVisibilityGap[],
  gapId: string,
  edge: 'start' | 'end',
  ms: number,
  durationMs: number,
): LayerVisibilityGap[] {
  const sorted = normalizeGaps(gaps, durationMs)
  const idx = sorted.findIndex((g) => g.id === gapId)
  if (idx < 0) return sorted

  const gap = sorted[idx]
  const prevEnd = idx > 0 ? sorted[idx - 1].endMs : 0
  const nextStart = idx < sorted.length - 1 ? sorted[idx + 1].startMs : durationMs

  if (edge === 'start') {
    const startMs = Math.max(prevEnd, Math.min(gap.endMs - MIN_GAP_MS, ms))
    return normalizeGaps(sorted.map((g) => (g.id === gapId ? { ...g, startMs } : g)), durationMs)
  }

  const endMs = Math.max(gap.startMs + MIN_GAP_MS, Math.min(nextStart, ms))
  return normalizeGaps(sorted.map((g) => (g.id === gapId ? { ...g, endMs } : g)), durationMs)
}

export function gapRoomAt(
  gaps: LayerVisibilityGap[],
  clickMs: number,
  durationMs: number,
): { start: number; end: number; size: number } | null {
  const sorted = normalizeGaps(gaps, durationMs)
  let prevEnd = 0
  for (const gap of sorted) {
    if (clickMs < gap.startMs) {
      return { start: prevEnd, end: gap.startMs, size: gap.startMs - prevEnd }
    }
    prevEnd = gap.endMs
  }
  return { start: prevEnd, end: durationMs, size: durationMs - prevEnd }
}

export function addGapAt(
  gaps: LayerVisibilityGap[],
  clickMs: number,
  durationMs: number,
): LayerVisibilityGap[] {
  const sorted = normalizeGaps(gaps, durationMs)
  const room = gapRoomAt(sorted, clickMs, durationMs)
  if (!room || room.size < MIN_GAP_MS) return sorted

  const span = Math.min(idealGapDuration(durationMs), room.size)
  if (span < MIN_GAP_MS) return sorted

  let startMs = clickMs - span / 2
  let endMs = clickMs + span / 2
  if (startMs < room.start) {
    startMs = room.start
    endMs = startMs + span
  }
  if (endMs > room.end) {
    endMs = room.end
    startMs = endMs - span
  }
  if (endMs - startMs < MIN_GAP_MS) return sorted

  return normalizeGaps(
    [...sorted, { id: createEntityId('vgap'), startMs, endMs }],
    durationMs,
  )
}

export function removeGap(gaps: LayerVisibilityGap[], gapId: string): LayerTiming {
  const next = gaps.filter((g) => g.id !== gapId)
  if (!next.length) return DEFAULT_LAYER_TIMING
  return { mode: 'gaps', gaps: next }
}

export type GapClipboard = {
  spanMs: number
}

let gapClipboard: GapClipboard | null = null

export function copyGapClipboard(gap: LayerVisibilityGap): GapClipboard {
  const template = { spanMs: gap.endMs - gap.startMs }
  gapClipboard = template
  return template
}

export function peekGapClipboard(): GapClipboard | null {
  return gapClipboard
}

export function roomAfter(
  gaps: LayerVisibilityGap[],
  afterMs: number,
  durationMs: number,
): { start: number; end: number; size: number } | null {
  const sorted = normalizeGaps(gaps, durationMs)
  const start = Math.max(0, Math.min(durationMs, afterMs))
  for (const gap of sorted) {
    if (gap.endMs <= start) continue
    if (gap.startMs > start) {
      return { start, end: gap.startMs, size: gap.startMs - start }
    }
    return null
  }
  return { start, end: durationMs, size: durationMs - start }
}

export function pasteGapAfter(
  gaps: LayerVisibilityGap[],
  afterMs: number,
  spanMs: number,
  durationMs: number,
): { gaps: LayerVisibilityGap[]; gapId: string | null; endMs: number | null } {
  const sorted = normalizeGaps(gaps, durationMs)
  const span = Math.max(MIN_GAP_MS, spanMs)
  const room = roomAfter(sorted, afterMs, durationMs)
  if (!room || room.size < span) {
    return { gaps: sorted, gapId: null, endMs: null }
  }

  const startMs = room.start
  const endMs = startMs + span
  const gapId = createEntityId('vgap')
  const next = normalizeGaps(
    [...sorted, { id: gapId, startMs, endMs }],
    durationMs,
  )
  return { gaps: next, gapId, endMs }
}

export type GapHitZone = 'start' | 'end' | 'body' | 'empty'

export function hitTestGap(
  gaps: LayerVisibilityGap[],
  x: number,
  width: number,
  durationMs: number,
): { gap: LayerVisibilityGap | null; zone: GapHitZone } {
  const ms = xToMs(x, width, durationMs)

  for (const gap of gaps) {
    const startX = msToX(gap.startMs, width, durationMs)
    const endX = msToX(gap.endMs, width, durationMs)
    if (ms < gap.startMs || ms > gap.endMs) continue

    if (Math.abs(x - startX) <= EDGE_THRESHOLD_PX) return { gap, zone: 'start' }
    if (Math.abs(x - endX) <= EDGE_THRESHOLD_PX) return { gap, zone: 'end' }
    return { gap, zone: 'body' }
  }

  return { gap: null, zone: 'empty' }
}
