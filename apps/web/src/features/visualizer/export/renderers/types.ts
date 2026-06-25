import type { LayerInstance } from '../../project/types'
import type { ExportRenderContext, LayerAssetManifest } from '../prepare'
import type { AudioFeatures } from '../../audio/audioTypes'

export interface CanvasRenderArgs {
  ctx: CanvasRenderingContext2D
  layer: LayerInstance
  /** Preflight manifest entry for this layer — present for image/video layers. */
  asset: LayerAssetManifest | undefined
  renderCtx: ExportRenderContext
  videoEls: Map<string, HTMLVideoElement>
  canvasW: number
  canvasH: number
  stageW: number
  stageH: number
  boxW: number
  boxH: number
  timeMs: number
  features: AudioFeatures
}

export interface CanvasLayerRenderer {
  /** Matches the value returned by resolveVisualKind() for layers this renderer handles. */
  readonly kind: string
  draw(args: CanvasRenderArgs): Promise<void> | void
}
