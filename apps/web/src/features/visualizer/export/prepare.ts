import type { Project, LayerInstance } from '../project/types'
import type { ExportPreset } from './presets'
import type { AudioAnalysisResult } from './audioAnalysis'
import { getOrComputeAnalysis } from './audioAnalysis'
import { WEBCODECS_SUPPORTED } from './webcodecs'
import { analyzeRendererSupport, canUseNativeRenderer } from './rendererSupport'
import type { RendererDiagnostics } from './rendererSupport'

// ── Error ─────────────────────────────────────────────────────────────────────

export class ExportValidationError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message)
    this.name = 'ExportValidationError'
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type PreparePhase = 'validating' | 'fonts' | 'assets' | 'audio' | 'rehearsal'

export interface PrepareProgress {
  readonly phase: PreparePhase
  readonly phaseLabel: string
  /** 0–1 across the entire preparation. */
  readonly overall: number
}

export interface LayerAssetManifest {
  readonly layerId: string
  readonly templateId: string
  readonly kind: 'image' | 'video' | 'other'
  readonly srcUrl: string | undefined
  readonly fileKey: string | undefined
  readonly available: boolean
  /** Preloaded GPU-resident bitmap for image assets. Call bitmap.close() after export. */
  readonly bitmap: ImageBitmap | undefined
}

/**
 * Minimal render context produced after the asset-preflight phase.
 * renderCanvasFrame accepts this so rehearsal can use the native renderer
 * before audio analysis is complete (audioAnalysis is null at that point).
 */
export interface ExportRenderContext {
  readonly layers: readonly LayerAssetManifest[]
  readonly audioAnalysis: AudioAnalysisResult | null
  readonly fps: number
  readonly durationMs: number
  readonly sourceDisplayWidth: number
  readonly sourceDisplayHeight: number
}

export interface ExportManifest extends ExportRenderContext {
  readonly projectName: string
  readonly outputWidth: number
  readonly outputHeight: number
  readonly preset: ExportPreset
  readonly audioUrl: string | undefined
  readonly audioFileKey: string | undefined
  /** Whether every visible layer was rendered natively during rehearsal. */
  readonly nativeRenderer: boolean
  readonly rendererDiagnostics: RendererDiagnostics
  /** Number of rehearsal frames that rendered without error (out of 3). */
  readonly rehearsalFramesOk: number
  readonly createdAt: number
}

export interface PrepareOptions {
  snapshot: Project
  preset: ExportPreset
  outputWidth: number
  outputHeight: number
  sourceDisplayWidth: number
  sourceDisplayHeight: number
  signal: AbortSignal
  /**
   * html2canvas compatibility renderer — always provided.
   * Used when the project has layers that aren't natively renderable.
   */
  rehearseCompat: (timeMs: number) => Promise<void>
  /**
   * Canvas-native renderer — provided when the caller supports it.
   * prepareExport will call this for rehearsal when all layers are natively
   * renderable, so the rehearsal tests the same code path as the encode loop.
   */
  rehearseNative?: (timeMs: number, ctx: ExportRenderContext) => Promise<void>
  onProgress: (progress: PrepareProgress) => void
}

// ── Phase progress weights ────────────────────────────────────────────────────

const WEIGHTS: Record<PreparePhase, [number, number]> = {
  validating: [0.00, 0.03],
  fonts:      [0.03, 0.07],
  assets:     [0.07, 0.40],
  audio:      [0.40, 0.85],
  rehearsal:  [0.85, 1.00],
}

const PHASE_LABELS: Record<PreparePhase, string> = {
  validating: 'Validating…',
  fonts:      'Loading fonts…',
  assets:     'Preflighting assets…',
  audio:      'Analysing audio…',
  rehearsal:  'Rehearsing frames…',
}

function report(
  onProgress: PrepareOptions['onProgress'],
  phase: PreparePhase,
  local = 0,
): void {
  const [lo, hi] = WEIGHTS[phase]
  onProgress({ phase, phaseLabel: PHASE_LABELS[phase], overall: lo + local * (hi - lo) })
}

// ── Asset helpers ─────────────────────────────────────────────────────────────

function layerKind(layer: LayerInstance): 'image' | 'video' | 'other' {
  if (layer.templateId === 'photo-cutout') return 'image'
  if (layer.templateId === 'video-layer')  return 'video'
  return 'other'
}

async function preflightLayer(
  layer: LayerInstance,
  signal: AbortSignal,
): Promise<LayerAssetManifest> {
  const kind    = layerKind(layer)
  const srcUrl  = layer.settings.src   != null ? String(layer.settings.src)    : undefined
  const fileKey = layer.settings.srcKey != null ? String(layer.settings.srcKey) : undefined

  if (!srcUrl || kind === 'other') {
    return { layerId: layer.id, templateId: layer.templateId, kind, srcUrl, fileKey, available: true, bitmap: undefined }
  }

  const isLocal = srcUrl.startsWith('blob:') || srcUrl.startsWith('data:')

  if (kind === 'image' && typeof createImageBitmap !== 'undefined') {
    try {
      const resp = isLocal
        ? await fetch(srcUrl, { signal })
        : await fetch(srcUrl, { signal, mode: 'cors' })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const blob   = await resp.blob()
      const bitmap = await createImageBitmap(blob)
      return { layerId: layer.id, templateId: layer.templateId, kind, srcUrl, fileKey, available: true, bitmap }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') throw e
      return { layerId: layer.id, templateId: layer.templateId, kind, srcUrl, fileKey, available: false, bitmap: undefined }
    }
  }

  if (isLocal) {
    return { layerId: layer.id, templateId: layer.templateId, kind, srcUrl, fileKey, available: true, bitmap: undefined }
  }
  try {
    const resp = await fetch(srcUrl, { signal, method: 'HEAD' })
    return { layerId: layer.id, templateId: layer.templateId, kind, srcUrl, fileKey, available: resp.ok, bitmap: undefined }
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e
    return { layerId: layer.id, templateId: layer.templateId, kind, srcUrl, fileKey, available: false, bitmap: undefined }
  }
}

// ── Pipeline ──────────────────────────────────────────────────────────────────

const REHEARSAL_POINTS = [0.05, 0.50, 0.95] as const

export async function prepareExport(opts: PrepareOptions): Promise<ExportManifest> {
  const {
    snapshot,
    preset,
    outputWidth,
    outputHeight,
    sourceDisplayWidth,
    sourceDisplayHeight,
    signal,
    rehearseCompat,
    rehearseNative,
    onProgress,
  } = opts
  const durationMs = (snapshot.audio?.duration ?? 0) * 1000

  // 1 ── Validate ────────────────────────────────────────────────────────────
  report(onProgress, 'validating')

  if (durationMs <= 0)
    throw new ExportValidationError('Audio track has no duration.', 'NO_DURATION')
  if (outputWidth <= 0 || outputHeight <= 0)
    throw new ExportValidationError(`Invalid output dimensions: ${outputWidth}×${outputHeight}`, 'INVALID_DIMENSIONS')
  if (preset.fps < 1 || preset.fps > 120)
    throw new ExportValidationError(`Unsupported frame rate: ${preset.fps} fps`, 'INVALID_FPS')
  if (!WEBCODECS_SUPPORTED && typeof MediaRecorder === 'undefined')
    throw new ExportValidationError('No video export capability in this browser.', 'NO_CAPABILITY')

  if (signal.aborted) throw new DOMException('Aborted', 'AbortError')

  // 2 ── Fonts ──────────────────────────────────────────────────────────────
  report(onProgress, 'fonts')
  try { await document.fonts.ready } catch { /* unsupported */ }

  if (signal.aborted) throw new DOMException('Aborted', 'AbortError')

  // 3 ── Asset preflight ─────────────────────────────────────────────────────
  report(onProgress, 'assets', 0)
  const layerResults = await Promise.allSettled(
    snapshot.layers.map((layer, idx) =>
      preflightLayer(layer, signal).then((m) => {
        report(onProgress, 'assets', (idx + 1) / Math.max(1, snapshot.layers.length))
        return m
      })
    )
  )

  const layers: LayerAssetManifest[] = layerResults.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : {
          layerId: snapshot.layers[i].id,
          templateId: snapshot.layers[i].templateId,
          kind: 'other' as const,
          srcUrl: undefined,
          fileKey: undefined,
          available: false,
          bitmap: undefined,
        }
  )

  if (signal.aborted) throw new DOMException('Aborted', 'AbortError')

  // Renderer selection — now that we have layer manifests (bitmaps), choose
  // whether native canvas can handle all layers. This drives rehearsal choice.
  const rendererDiagnostics = analyzeRendererSupport(snapshot.layers)
  const nativeRenderer = rendererDiagnostics.mode === 'native' && rehearseNative != null

  // Build minimal render context for native rehearsal (audioAnalysis is null
  // here — rehearsal tests visual structure, not audio reactivity).
  const rehearsalCtx: ExportRenderContext = {
    layers,
    audioAnalysis: null,
    fps: preset.fps,
    durationMs,
    sourceDisplayWidth,
    sourceDisplayHeight,
  }

  // 4 ── Audio analysis ──────────────────────────────────────────────────────
  report(onProgress, 'audio', 0)
  let audioAnalysis: AudioAnalysisResult | null = null
  const audioUrl     = snapshot.audio?.url
  const audioFileKey = snapshot.audio?.fileKey

  if (audioUrl) {
    try {
      audioAnalysis = await getOrComputeAnalysis(
        audioUrl, audioFileKey, preset.fps, durationMs, signal,
      )
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') throw e
      // Non-fatal — proceed without analysis.
    }
  }
  report(onProgress, 'audio', 1)

  if (signal.aborted) throw new DOMException('Aborted', 'AbortError')

  // 5 ── Rehearsal frames ────────────────────────────────────────────────────
  // Native rehearsal: uses renderCanvasFrame so failures here predict real failures.
  // Compat rehearsal: html2canvas, used as fallback or when no native callback provided.
  let rehearsalFramesOk = 0
  for (let i = 0; i < REHEARSAL_POINTS.length; i++) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
    report(onProgress, 'rehearsal', i / REHEARSAL_POINTS.length)
    const timeMs = REHEARSAL_POINTS[i] * durationMs
    try {
      if (nativeRenderer) {
        await rehearseNative!(timeMs, rehearsalCtx)
      } else {
        await rehearseCompat(timeMs)
      }
      rehearsalFramesOk++
    } catch { /* count, don't abort */ }
  }
  report(onProgress, 'rehearsal', 1)

  return Object.freeze<ExportManifest>({
    projectName: snapshot.name,
    durationMs,
    fps: preset.fps,
    outputWidth,
    outputHeight,
    sourceDisplayWidth,
    sourceDisplayHeight,
    preset,
    audioUrl,
    audioFileKey,
    layers,
    audioAnalysis,
    nativeRenderer,
    rendererDiagnostics,
    rehearsalFramesOk,
    createdAt: Date.now(),
  })
}

export type { RendererDiagnostics }
