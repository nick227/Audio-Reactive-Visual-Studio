import type { CanvasLayerRenderer, CanvasRenderArgs } from './types'
import type { AudioFeatures } from '../../audio/audioTypes'

// All frame renderers draw in the layer-centric coordinate system where (0,0) is the
// layer centre and the usable area is [-boxW/2, boxW/2] × [-boxH/2, boxH/2].
// Frames typically use fit:stretch so boxW ≈ canvasW and boxH ≈ canvasH.

// ── VHS border ────────────────────────────────────────────────────────────────

function drawVhsFrame(
  ctx: CanvasRenderingContext2D,
  boxW: number,
  boxH: number,
  t: number,
  features: AudioFeatures,
  color: string,
): void {
  const hx = boxW / 2, hy = boxH / 2
  const baseA = ctx.globalAlpha

  ctx.strokeStyle = color
  ctx.fillStyle   = color

  // Outer border — thicker on all sides.
  const bw = Math.round(boxW * 0.03)
  const bh = Math.round(boxH * 0.03)
  ctx.lineWidth = 2
  ctx.strokeRect(-hx + bw / 2, -hy + bh / 2, boxW - bw, boxH - bh)

  // Corner brackets.
  const cs = Math.round(Math.min(boxW, boxH) * 0.08)
  ctx.lineWidth = 3
  const corners: [number, number, number, number][] = [
    [-hx, -hy, cs,  cs], [hx,  -hy, -cs,  cs],
    [-hx,  hy, cs, -cs], [hx,   hy, -cs, -cs],
  ]
  for (const [cx, cy, dx, dy] of corners) {
    ctx.beginPath()
    ctx.moveTo(cx + dx, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + dy)
    ctx.stroke()
  }

  // REC indicator — flashes at beat.
  const recAlpha = 0.5 + features.beat * 0.5
  ctx.globalAlpha = baseA * recAlpha
  ctx.fillStyle   = '#ff2222'
  const rx = -hx + bw + Math.round(boxW * 0.025)
  const ry = -hy + bh + Math.round(boxH * 0.025)
  const rr = Math.round(Math.min(boxW, boxH) * 0.018)
  ctx.beginPath()
  ctx.arc(rx, ry, rr, 0, Math.PI * 2)
  ctx.fill()
  // "REC" text next to dot.
  const fs = Math.round(boxH * 0.028)
  ctx.fillStyle   = color
  ctx.globalAlpha = baseA * recAlpha
  ctx.font        = `700 ${fs}px monospace`
  ctx.textAlign   = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText('REC', rx + rr * 2, ry)

  // Horizontal tracking bar — drifts slowly, stronger on beat.
  if (features.beat > 0.1) {
    const barY = -hy + ((t * 90 + features.beat * hy) % boxH)
    const barH = 2 + features.beat * 6
    ctx.globalAlpha = baseA * features.beat * 0.35
    ctx.fillStyle   = color
    ctx.fillRect(-hx, barY, boxW, barH)
  }

  ctx.globalAlpha  = baseA
  ctx.textAlign    = 'center'
  ctx.textBaseline = 'middle'
}

// ── Film strip ────────────────────────────────────────────────────────────────

function drawFilmStripFrame(
  ctx: CanvasRenderingContext2D,
  boxW: number,
  boxH: number,
  t: number,
  features: AudioFeatures,
  color: string,
): void {
  const hx    = boxW / 2, hy = boxH / 2
  const strip = Math.round(boxW * 0.065)   // width of the perforated side strip
  const perfW = Math.round(strip * 0.52)
  const perfH = Math.round(perfW * 1.3)
  const gap   = Math.round(perfH * 1.5)
  // Scroll perforations with time.
  const scrollY = (t * 30 * (1 + features.full * 0.3)) % gap
  const baseA   = ctx.globalAlpha

  ctx.fillStyle = color

  for (const side of [-1, 1] as const) {
    const sx = side === -1 ? -hx : hx - strip
    // Side strip background.
    ctx.globalAlpha = baseA * 0.92
    ctx.fillRect(sx, -hy, strip, boxH)

    // Perforations — cut out with destination-out blend.
    ctx.globalCompositeOperation = 'destination-out'
    const px = sx + (strip - perfW) / 2
    for (let y = -hy - gap + scrollY; y < hy + gap; y += gap) {
      const ry = Math.round(y)
      ctx.fillRect(Math.round(px), ry, perfW, perfH)
    }
    ctx.globalCompositeOperation = 'source-over'
  }

  ctx.globalAlpha = baseA
}

// ── Polaroid ──────────────────────────────────────────────────────────────────

function drawPolaroidFrame(
  ctx: CanvasRenderingContext2D,
  boxW: number,
  boxH: number,
  _t: number,
  _features: AudioFeatures,
  color: string,
): void {
  const hx    = boxW / 2, hy = boxH / 2
  const side  = Math.round(boxW * 0.04)   // equal top/left/right border
  const bot   = Math.round(boxH * 0.16)   // larger bottom border (polaroid signature)
  const baseA = ctx.globalAlpha

  ctx.fillStyle   = color
  ctx.globalAlpha = baseA * 0.97

  // Top border.
  ctx.fillRect(-hx, -hy, boxW, side)
  // Bottom border.
  ctx.fillRect(-hx, hy - bot, boxW, bot)
  // Left border.
  ctx.fillRect(-hx, -hy + side, side, boxH - side - bot)
  // Right border.
  ctx.fillRect(hx - side, -hy + side, side, boxH - side - bot)

  // Subtle drop shadow (inner edge gradient-like effect via extra fill).
  ctx.globalAlpha = baseA * 0.12
  ctx.fillRect(-hx + side, -hy + side, boxW - 2 * side, 3)
  ctx.fillRect(-hx + side, -hy + side, 3, boxH - side - bot)

  ctx.globalAlpha = baseA
}

// ── Renderer ──────────────────────────────────────────────────────────────────

export const frameRenderer: CanvasLayerRenderer = {
  kind: 'frame',
  draw({ ctx, layer, boxW, boxH, timeMs, features }: CanvasRenderArgs): void {
    const kind  = String(layer.settings.frameKind ?? 'vhs')
    const color = String(layer.settings.color     ?? '#ffffff')
    const t     = timeMs / 1000

    switch (kind) {
      case 'vhs':       drawVhsFrame(ctx, boxW, boxH, t, features, color);       break
      case 'filmstrip': drawFilmStripFrame(ctx, boxW, boxH, t, features, color); break
      case 'polaroid':  drawPolaroidFrame(ctx, boxW, boxH, t, features, color);  break
      default:          drawVhsFrame(ctx, boxW, boxH, t, features, color)
    }
  },
}
