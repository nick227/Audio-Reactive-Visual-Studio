import type { CanvasLayerRenderer, CanvasRenderArgs } from './types'

function resolveTypeFont(typeKind: string, sizePx: number): string {
  const s = `${sizePx}px`
  switch (typeKind) {
    case 'block':
    case 'number':
    case 'chrome':
    case 'ransom':
      return `900 ${s} "Arial Black", Impact, sans-serif`
    case 'neon':
    case 'holo':
    case 'glitch':
    case 'outline':
    case 'vertical':
      return `700 ${s} Arial, sans-serif`
    case 'sticker':
    case 'bubble':
      return `800 ${s} Arial, sans-serif`
    default:
      return `400 ${s} Arial, sans-serif`
  }
}

export const typographyRenderer: CanvasLayerRenderer = {
  kind: 'typography',
  draw({ ctx, layer, canvasH }: CanvasRenderArgs): void {
    const typeKind = String(layer.settings.typeKind ?? 'block')
    const color    = String(layer.settings.color    ?? '#ffffff')
    const text     = String(layer.settings.text     ?? 'TEXT')
    const sizePx   = Math.round(canvasH * 0.10)

    ctx.font         = resolveTypeFont(typeKind, sizePx)
    ctx.textAlign    = 'center'
    ctx.textBaseline = 'middle'

    if (typeKind === 'neon' || typeKind === 'holo') {
      ctx.shadowColor = color
      ctx.shadowBlur  = sizePx * 0.35
    }

    if (typeKind === 'glitch') {
      const baseAlpha = ctx.globalAlpha
      ctx.globalAlpha = baseAlpha * 0.8
      ctx.fillStyle = '#ff0040'; ctx.fillText(text, -4, 0)
      ctx.fillStyle = '#00ffff'; ctx.fillText(text,  4, 0)
      ctx.globalAlpha = baseAlpha
      ctx.fillStyle = color;     ctx.fillText(text,  0, 0)
    } else if (typeKind === 'outline') {
      ctx.strokeStyle = color
      ctx.lineWidth   = Math.max(2, sizePx * 0.04)
      ctx.strokeText(text, 0, 0)
    } else if (typeKind === 'vertical') {
      ctx.save()
      ctx.rotate(-Math.PI / 2)
      ctx.fillStyle = color
      ctx.fillText(text, 0, 0)
      ctx.restore()
    } else {
      ctx.fillStyle = color
      ctx.fillText(text, 0, 0)
    }

    ctx.shadowColor = 'transparent'
    ctx.shadowBlur  = 0
  },
}
