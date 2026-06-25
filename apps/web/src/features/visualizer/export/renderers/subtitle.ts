import type { CanvasLayerRenderer, CanvasRenderArgs } from './types'
import { findActiveCue } from '../../subtitles/parseSrt'
import type { SrtCue } from '../../subtitles/parseSrt'
import { DEFAULT_SUBTITLE_WIDTH, wrapTextToWidth } from '../../subtitles/layout'

type SubtitleDrawStyle = {
  font: string
  fontPx: number
  lineH: number
  gap: number
  paddingX: number
  paddingY: number
  radius: number
  color: string
  background?: string
  border?: string
  shadow?: {
    color: string
    blur: number
    offsetY: number
  }
  stroke?: {
    color: string
    width: number
    shadow?: string
  }
}

export const subtitleRenderer: CanvasLayerRenderer = {
  kind: 'subtitle',
  draw({ ctx, layer, canvasW, canvasH, stageH, boxH, timeMs }: CanvasRenderArgs): void {
    const cues      = (layer.settings.cues ?? []) as SrtCue[]
    const activeCue = findActiveCue(cues, timeMs)
    if (!activeCue) return

    const color   = String(layer.settings.color ?? '#ffffff')
    const styleId = String(layer.settings.subtitleStyle ?? 'cinematic')
    const stageFs = Number(layer.settings.fontSize ?? 48)
    const offsetY = Math.max(0, Math.min(100, Number(layer.settings.subtitleOffsetY ?? 10)))
    const subtitleWidthPct = Number(layer.settings.subtitleWidth ?? DEFAULT_SUBTITLE_WIDTH)
    const scaleY  = canvasH / stageH
    const style   = subtitleDrawStyle(styleId, color, stageFs * scaleY, scaleY)
    const maxTextW = (subtitleWidthPct / 100) * canvasW - style.paddingX * 2

    ctx.save()
    ctx.font = style.font
    const lines = activeCue.text
      .split('\n')
      .flatMap((line) => wrapTextToWidth(ctx, line, maxTextW))
    ctx.restore()

    const blockH  = lines.length * style.lineH + Math.max(0, lines.length - 1) * style.gap
    const bottomY = boxH / 2 - (offsetY / 100) * boxH
    const topY    = bottomY - blockH

    ctx.save()
    ctx.font = style.font
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    lines.forEach((line, i) => {
      const centerY = topY + i * (style.lineH + style.gap) + style.lineH / 2
      drawSubtitleLine(ctx, line, centerY, style)
    })

    ctx.restore()
  },
}

function subtitleDrawStyle(styleId: string, color: string, basePx: number, stageScale: number): SubtitleDrawStyle {
  const gap = 4 * stageScale

  switch (styleId) {
    case 'pop': {
      const fontPx = basePx * 1.05
      return {
        font: `800 ${fontPx}px Inter, Arial, sans-serif`,
        fontPx,
        lineH: fontPx * 1.3,
        gap,
        paddingX: fontPx * 0.6,
        paddingY: fontPx * 0.14,
        radius: fontPx,
        color,
        background: 'rgba(120,60,240,0.85)',
        shadow: { color: 'rgba(100,40,240,0.5)', blur: 14 * stageScale, offsetY: 2 * stageScale },
      }
    }
    case 'karaoke': {
      const fontPx = basePx * 1.1
      return {
        font: `900 ${fontPx}px Impact, "Arial Black", sans-serif`,
        fontPx,
        lineH: fontPx * 1.3,
        gap,
        paddingX: 0,
        paddingY: 0,
        radius: 0,
        color: '#ffc83d',
        stroke: {
          color: '#000000',
          width: 4 * stageScale,
          shadow: 'rgba(255,200,0,0.5)',
        },
      }
    }
    case 'retro': {
      const fontPx = basePx * 0.95
      return {
        font: `${fontPx}px "Courier New", Courier, monospace`,
        fontPx,
        lineH: fontPx * 1.3,
        gap,
        paddingX: fontPx * 0.5,
        paddingY: fontPx * 0.12,
        radius: 2 * stageScale,
        color: '#3dff88',
        background: 'rgba(0,0,0,0.85)',
        border: 'rgba(61,255,136,0.3)',
        shadow: { color: 'rgba(61,255,136,0.6)', blur: 8 * stageScale, offsetY: 0 },
      }
    }
    case 'minimal': {
      const fontPx = basePx
      return {
        font: `500 ${fontPx}px Inter, Arial, sans-serif`,
        fontPx,
        lineH: fontPx * 1.3,
        gap,
        paddingX: fontPx * 0.45,
        paddingY: fontPx * 0.1,
        radius: 4 * stageScale,
        color,
        background: 'rgba(0,0,0,0.35)',
      }
    }
    case 'cinematic':
    default: {
      const fontPx = basePx
      return {
        font: `${fontPx}px Georgia, "Times New Roman", serif`,
        fontPx,
        lineH: fontPx * 1.3,
        gap,
        paddingX: fontPx * 0.55,
        paddingY: fontPx * 0.18,
        radius: 4 * stageScale,
        color,
        background: 'rgba(0,0,0,0.6)',
        shadow: { color: 'rgba(0,0,0,0.9)', blur: 8 * stageScale, offsetY: 1 * stageScale },
      }
    }
  }
}

function drawSubtitleLine(ctx: CanvasRenderingContext2D, line: string, centerY: number, style: SubtitleDrawStyle) {
  const metrics = ctx.measureText(line)
  const boxW = metrics.width + style.paddingX * 2
  const boxH = style.lineH + style.paddingY * 2
  const boxX = -boxW / 2
  const boxY = centerY - boxH / 2

  if (style.shadow && style.background) {
    ctx.save()
    ctx.shadowColor = style.shadow.color
    ctx.shadowBlur = style.shadow.blur
    ctx.shadowOffsetY = style.shadow.offsetY
    drawRoundedRect(ctx, boxX, boxY, boxW, boxH, style.radius)
    ctx.fillStyle = style.background
    ctx.fill()
    ctx.restore()
  } else if (style.background) {
    drawRoundedRect(ctx, boxX, boxY, boxW, boxH, style.radius)
    ctx.fillStyle = style.background
    ctx.fill()
  }

  if (style.border) {
    drawRoundedRect(ctx, boxX, boxY, boxW, boxH, style.radius)
    ctx.strokeStyle = style.border
    ctx.lineWidth = 1
    ctx.stroke()
  }

  if (style.stroke) {
    ctx.save()
    ctx.lineJoin = 'round'
    ctx.miterLimit = 2
    ctx.strokeStyle = style.stroke.color
    ctx.lineWidth = style.stroke.width
    ctx.strokeText(line, 0, centerY)
    if (style.stroke.shadow) {
      ctx.shadowColor = style.stroke.shadow
      ctx.shadowBlur = style.fontPx * 0.24
      ctx.shadowOffsetY = style.fontPx * 0.04
      ctx.fillStyle = style.color
      ctx.fillText(line, 0, centerY)
    }
    ctx.restore()
  }

  if (style.shadow && !style.background) {
    ctx.shadowColor = style.shadow.color
    ctx.shadowBlur = style.shadow.blur
    ctx.shadowOffsetY = style.shadow.offsetY
  }
  ctx.fillStyle = style.color
  ctx.fillText(line, 0, centerY)
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  if (r <= 0) {
    ctx.beginPath()
    ctx.rect(x, y, w, h)
    return
  }
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2))
}
