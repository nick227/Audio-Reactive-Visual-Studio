import type { CanvasLayerRenderer, CanvasRenderArgs } from './types'
import { findActiveCue } from '../../subtitles/parseSrt'
import type { SrtCue } from '../../subtitles/parseSrt'

export const subtitleRenderer: CanvasLayerRenderer = {
  kind: 'subtitle',
  // ctx is translated to the layer centre (which for a full-stretch subtitle is the canvas centre).
  // canvasH/2 from the translated origin = the bottom edge of the canvas.
  draw({ ctx, layer, canvasH, stageH, timeMs }: CanvasRenderArgs): void {
    const cues      = (layer.settings.cues ?? []) as SrtCue[]
    const activeCue = findActiveCue(cues, timeMs)
    if (!activeCue) return

    const color   = String(layer.settings.color         ?? '#ffffff')
    const stageFs = Number(layer.settings.fontSize       ?? 48)
    const offsetY = Number(layer.settings.subtitleOffsetY ?? 10)
    const sizePx  = Math.round(stageFs * (canvasH / stageH))
    const lineH   = sizePx * 1.35

    ctx.font          = `600 ${sizePx}px Arial, sans-serif`
    ctx.textAlign     = 'center'
    ctx.textBaseline  = 'alphabetic'
    ctx.fillStyle     = color
    ctx.shadowColor   = 'rgba(0,0,0,0.85)'
    ctx.shadowOffsetY = Math.round(sizePx * 0.04)
    ctx.shadowBlur    = sizePx * 0.08

    const lines = activeCue.text.split('\n')
    const baseY = canvasH / 2 - (offsetY / 100) * canvasH
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], 0, baseY - (lines.length - 1 - i) * lineH)
    }

    ctx.shadowColor   = 'transparent'
    ctx.shadowOffsetY = 0
    ctx.shadowBlur    = 0
  },
}
