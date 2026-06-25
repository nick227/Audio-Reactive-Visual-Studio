import type { CanvasLayerRenderer, CanvasRenderArgs } from './types'

export const shapeRenderer: CanvasLayerRenderer = {
  kind: 'shape',
  draw({ ctx, layer, boxW, boxH }: CanvasRenderArgs): void {
    const color = String(layer.settings.color ?? '#ffffff')
    const kind  = String(layer.settings.shapeKind ?? 'circle')
    ctx.fillStyle = color
    if (kind === 'circle') {
      ctx.beginPath()
      ctx.ellipse(0, 0, boxW / 2, boxH / 2, 0, 0, Math.PI * 2)
      ctx.fill()
    } else {
      ctx.fillRect(-boxW / 2, -boxH / 2, boxW, boxH)
    }
  },
}
