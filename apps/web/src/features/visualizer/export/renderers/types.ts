import type { LayerInstance } from '../../project/types'
import type { ExportRenderContext, LayerAssetManifest } from '../prepare'
import type { AudioFeatures } from '../../audio/audioTypes'
import type { EffectTransform } from '../../runtime/effects'

export interface CanvasLayerGeometry {
  readonly displayScaleX: number
  readonly displayScaleY: number
  readonly exportScaleX: number
  readonly exportScaleY: number
  readonly displayStageW: number
  readonly displayStageH: number
  readonly exportCanvasW: number
  readonly exportCanvasH: number
  readonly displayCenterX: number
  readonly displayCenterY: number
  readonly displayBoxW: number
  readonly displayBoxH: number
  readonly exportCenterX: number
  readonly exportCenterY: number
  readonly exportBoxW: number
  readonly exportBoxH: number
}

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
  transform: EffectTransform
  geometry: CanvasLayerGeometry
}

export interface CanvasLayerRenderer {
  /** Matches the value returned by resolveVisualKind() for layers this renderer handles. */
  readonly kind: string
  draw(args: CanvasRenderArgs): Promise<void> | void
}
