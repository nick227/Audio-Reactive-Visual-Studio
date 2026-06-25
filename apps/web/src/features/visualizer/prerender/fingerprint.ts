import type { ExportPreset } from '../export/presets'
import { isLayerVisibleAtTime } from '../layers/layerVisibilityTiming'
import type { LayerInstance, Project } from '../project/types'
import { resolveVisualKind } from '../runtime/layerVisualKind'
import type { PrerenderChunk } from './chunks'

export type RenderChunkFingerprint = {
  readonly projectId: string
  readonly chunkIndex: number
  readonly startMs: number
  readonly endMs: number
  readonly width: number
  readonly height: number
  readonly fps: number
  readonly presetId: string
  readonly audioHash: string
  readonly layerHash: string
}

export type RenderChunkIdentity = RenderChunkFingerprint & {
  readonly key: string
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value && typeof value === 'object') {
    const input = value as Record<string, unknown>
    const output: Record<string, unknown> = {}
    for (const key of Object.keys(input).sort()) {
      const v = input[key]
      if (typeof v !== 'function' && typeof v !== 'undefined') output[key] = stableValue(v)
    }
    return output
  }
  return value
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(stableValue(value))
}

export function hashString(input: string): string {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(36)
}

function layerIsActiveInChunk(layer: LayerInstance, chunk: PrerenderChunk, durationMs: number): boolean {
  if (!layer.visible) return false
  const midMs = chunk.startMs + (chunk.endMs - chunk.startMs) / 2
  return (
    isLayerVisibleAtTime(layer, chunk.startMs, durationMs) ||
    isLayerVisibleAtTime(layer, midMs, durationMs) ||
    isLayerVisibleAtTime(layer, Math.max(chunk.startMs, chunk.endMs - 1), durationMs)
  )
}

function chunkScopedSettings(layer: LayerInstance, visualKind: string, chunk: PrerenderChunk): unknown {
  if (visualKind !== 'subtitle') return layer.settings
  const cues = Array.isArray(layer.settings.cues)
    ? layer.settings.cues.filter((cue) => {
        if (!cue || typeof cue !== 'object') return false
        const startMs = Number((cue as { startMs?: unknown }).startMs)
        const endMs = Number((cue as { endMs?: unknown }).endMs)
        return Number.isFinite(startMs) && Number.isFinite(endMs) && startMs <= chunk.endMs && endMs >= chunk.startMs
      })
    : []
  const settings = { ...layer.settings }
  delete settings.cues
  return { ...settings, cues }
}

function layerFingerprint(layer: LayerInstance, chunk: PrerenderChunk): unknown {
  const visualKind = resolveVisualKind(layer)
  return {
    id: layer.id,
    templateId: layer.templateId,
    visualKind,
    visible: layer.visible,
    placement: layer.placement,
    reaction: layer.reaction,
    settings: chunkScopedSettings(layer, visualKind, chunk),
    timing: layer.timing,
  }
}

export function fingerprintChunk(
  project: Project,
  chunk: PrerenderChunk,
  preset: ExportPreset,
  width: number,
  height: number,
): RenderChunkIdentity {
  const durationMs = (project.audio?.duration ?? 0) * 1000
  const activeLayers = project.layers
    .filter((layer) => layerIsActiveInChunk(layer, chunk, durationMs))
    .map((layer) => layerFingerprint(layer, chunk))

  const audioHash = hashString(stableStringify({
    fileKey: project.audio?.fileKey,
    url: project.audio?.url,
    duration: project.audio?.duration,
    updatedAt: project.audio?.updatedAt,
  }))

  const layerHash = hashString(stableStringify({
    stage: project.stage,
    layers: activeLayers,
  }))

  const fingerprint: RenderChunkFingerprint = {
    projectId: project.id,
    chunkIndex: chunk.index,
    startMs: chunk.startMs,
    endMs: chunk.endMs,
    width,
    height,
    fps: preset.fps,
    presetId: preset.id,
    audioHash,
    layerHash,
  }

  return {
    ...fingerprint,
    key: hashString(stableStringify(fingerprint)),
  }
}

export function buildChunkFingerprintMap(
  project: Project,
  chunks: readonly PrerenderChunk[],
  preset: ExportPreset,
  width: number,
  height: number,
): Map<number, RenderChunkIdentity> {
  return new Map(chunks.map((chunk) => [chunk.index, fingerprintChunk(project, chunk, preset, width, height)]))
}

export function detectDirtyChunkIndexes(
  previous: ReadonlyMap<number, RenderChunkIdentity> | null,
  next: ReadonlyMap<number, RenderChunkIdentity>,
): Set<number> {
  if (!previous) return new Set(next.keys())
  const dirty = new Set<number>()
  for (const [index, identity] of next) {
    if (previous.get(index)?.key !== identity.key) dirty.add(index)
  }
  return dirty
}
