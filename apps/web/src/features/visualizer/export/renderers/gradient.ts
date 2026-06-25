import type { CanvasLayerRenderer, CanvasRenderArgs } from './types'

export const gradientRenderer: CanvasLayerRenderer = {
  kind: 'gradient',
  draw({ ctx, layer, canvasW, canvasH }: CanvasRenderArgs): void {
    const a = String(layer.settings.colorA ?? '#0b1021')
    const b = String(layer.settings.colorB ?? '#6f2cff')
    const c = String(layer.settings.colorC ?? '#00eaff')
    const grad = ctx.createLinearGradient(-canvasW / 2, -canvasH / 2, canvasW / 2, canvasH / 2)
    grad.addColorStop(0, a)
    grad.addColorStop(0.5, b)
    grad.addColorStop(1, c)
    ctx.fillStyle = grad
    ctx.fillRect(-canvasW / 2, -canvasH / 2, canvasW, canvasH)
  },
}
