import type { Project } from '../project/types'
import type { ExportRenderContext, LayerAssetManifest } from './prepare'
import type { AudioFeatures } from '../audio/audioTypes'
import { silentAudioFeatures } from '../audio/audioTypes'
import { resolveVisualKind } from '../runtime/layerVisualKind'
import { computeLayerTransform } from '../runtime/effects'
import { isLayerVisibleAtTime } from '../layers/layerVisibilityTiming'
import type { AudioAnalysisResult } from './audioAnalysis'
import { layerBoxPx } from './renderers/drawUtils'
import { getRenderer } from './renderers/registry'
import { applyMotionEffectModifier } from './renderers/motionEffect'
import './renderers/index'  // registers all renderers (side effect)

// Re-export public surface — callers import from renderCanvasFrame, not sub-modules.
export { canUseNativeRenderer, analyzeRendererSupport } from './rendererSupport'
export { createExportVideoElements, disposeExportVideoElements } from './renderers/video'

// ── Helpers ───────────────────────────────────────────────────────────────────

function featuresAt(
  analysis: AudioAnalysisResult | null,
  fps: number,
  timeMs: number,
): AudioFeatures {
  if (!analysis || !analysis.rmsPerFrame.length) return silentAudioFeatures
  const idx  = Math.min(Math.floor((timeMs / 1000) * fps), analysis.rmsPerFrame.length - 1)
  const rms  = analysis.rmsPerFrame[idx]       ?? 0
  const bass = analysis.bassPerFrame[idx]       ?? 0
  const trns = analysis.transientsPerFrame[idx] ?? 0
  return { bass, beat: trns, vocals: rms, highs: rms, full: rms }
}

// ── Main render function ──────────────────────────────────────────────────────

export async function renderCanvasFrame(
  ctx: CanvasRenderingContext2D,
  snapshot: Project,
  renderCtx: ExportRenderContext,
  videoEls: Map<string, HTMLVideoElement>,
  timeMs: number,
): Promise<void> {
  const canvasW    = ctx.canvas.width
  const canvasH    = ctx.canvas.height
  const stageW     = snapshot.stage.width
  const stageH     = snapshot.stage.height
  const displayW   = renderCtx.sourceDisplayWidth || stageW
  const displayH   = renderCtx.sourceDisplayHeight || stageH
  const displayScaleX = displayW / stageW
  const displayScaleY = displayH / stageH
  const exportScaleX  = canvasW / displayW
  const exportScaleY  = canvasH / displayH
  const durationMs = renderCtx.durationMs
  const features   = featuresAt(renderCtx.audioAnalysis, renderCtx.fps, timeMs)

  const assetByLayerId = new Map<string, LayerAssetManifest>(
    renderCtx.layers.map((m) => [m.layerId, m])
  )

  // Background
  ctx.clearRect(0, 0, canvasW, canvasH)
  ctx.fillStyle = snapshot.stage.backgroundColor
  ctx.fillRect(0, 0, canvasW, canvasH)

  // Layers — bottom-to-top
  for (const layer of snapshot.layers) {
    if (!isLayerVisibleAtTime(layer, timeMs, durationMs)) continue

    const visualKind = resolveVisualKind(layer)
    const transform  = computeLayerTransform(layer, features, timeMs)

    // motionEffect layers are full-frame compositing modifiers.
    // They bypass the per-layer positioning system and draw directly onto the canvas.
    if (visualKind === 'motionEffect') {
      ctx.save()
      ctx.globalAlpha = Math.max(0, Math.min(1, transform.opacity))
      applyMotionEffectModifier(ctx, layer, features, canvasW, canvasH, timeMs)
      ctx.restore()
      continue
    }

    const renderer = getRenderer(visualKind)
    if (!renderer) continue   // unsupported kind — compat mode handles these

    const { w: displayBoxW, h: displayBoxH } = layerBoxPx(layer.placement.fit, displayW, displayH)
    const displayCenterX = displayW / 2 + transform.x * displayScaleX
    const displayCenterY = displayH / 2 + transform.y * displayScaleY
    const boxW = displayBoxW * exportScaleX
    const boxH = displayBoxH * exportScaleY
    const cx = displayCenterX * exportScaleX
    const cy = displayCenterY * exportScaleY

    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate((transform.rotation * Math.PI) / 180)
    ctx.scale(transform.scale, transform.scale)
    ctx.globalAlpha = Math.max(0, Math.min(1, transform.opacity))
    if (transform.filter) ctx.filter = transform.filter

    await renderer.draw({
      ctx,
      layer,
      asset: assetByLayerId.get(layer.id),
      renderCtx,
      videoEls,
      canvasW,
      canvasH,
      stageW,
      stageH,
      boxW,
      boxH,
      timeMs,
      features,
      transform,
      geometry: {
        displayScaleX,
        displayScaleY,
        exportScaleX,
        exportScaleY,
        displayStageW: displayW,
        displayStageH: displayH,
        exportCanvasW: canvasW,
        exportCanvasH: canvasH,
        displayCenterX,
        displayCenterY,
        displayBoxW,
        displayBoxH,
        exportCenterX: cx,
        exportCenterY: cy,
        exportBoxW: boxW,
        exportBoxH: boxH,
      },
    })

    ctx.filter      = 'none'
    ctx.globalAlpha = 1
    ctx.restore()
  }
}
