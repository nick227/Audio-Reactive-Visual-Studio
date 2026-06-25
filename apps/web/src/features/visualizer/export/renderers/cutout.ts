import type { CanvasLayerRenderer, CanvasRenderArgs } from './types'
import { drawImageFitted } from './drawUtils'

export const cutoutRenderer: CanvasLayerRenderer = {
  kind: 'cutout',
  draw({ ctx, layer, asset, boxW, boxH }: CanvasRenderArgs): void {
    if (!asset?.bitmap) return
    drawImageFitted(ctx, asset.bitmap, asset.bitmap.width, asset.bitmap.height, boxW, boxH, layer.placement.fit)
  },
}
