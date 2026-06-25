import type { CanvasLayerRenderer, CanvasRenderArgs } from './types'
import type { AudioFeatures } from '../../audio/audioTypes'

// ── Sub-renderers (ctx translated to layer centre, boxW×boxH drawing area) ────

function drawScanlines(
  ctx: CanvasRenderingContext2D,
  boxW: number,
  boxH: number,
  t: number,
  features: AudioFeatures,
  color: string,
): void {
  const spacing = 3
  // Slow vertical drift — gives a "rolling" tape feel.
  const drift   = (t * 8) % spacing
  const baseA   = ctx.globalAlpha

  ctx.fillStyle = color
  ctx.globalCompositeOperation = 'multiply'

  // Every other line slightly dimmer for interlaced look.
  let row = 0
  for (let y = -boxH / 2 - spacing + drift; y < boxH / 2; y += spacing, row++) {
    const alpha = row % 2 === 0
      ? 0.18 + features.highs * 0.06
      : 0.08 + features.highs * 0.03
    ctx.globalAlpha = baseA * alpha
    ctx.fillRect(-boxW / 2, y, boxW, 1)
  }

  ctx.globalAlpha            = baseA
  ctx.globalCompositeOperation = 'source-over'
}

function drawPaperGrain(
  ctx: CanvasRenderingContext2D,
  boxW: number,
  boxH: number,
  t: number,
  features: AudioFeatures,
  color: string,
): void {
  // Coarse grain: 3×3px cells whose lightness is derived deterministically from position.
  // Tiled over a 192-cell period so pattern doesn't look perfectly regular.
  const cell  = 3
  const PERIOD = 192  // tile period in cells
  const baseA  = ctx.globalAlpha

  ctx.globalCompositeOperation = 'overlay'
  ctx.fillStyle = color

  // Compute values column-by-column to minimise fillStyle state changes.
  for (let x = -boxW / 2 | 0; x < boxW / 2; x += cell) {
    const cx = (((x + boxW / 2) / cell) | 0) % PERIOD
    for (let y = -boxH / 2 | 0; y < boxH / 2; y += cell) {
      const cy = (((y + boxH / 2) / cell) | 0) % PERIOD
      // Deterministic pseudo-noise via trig product — cheap and visually random.
      const v = Math.abs(Math.sin(cx * 0.731 + cy * 0.549 + t * 0.04))
      const alpha = v * (0.22 + features.full * 0.08)
      ctx.globalAlpha = baseA * alpha
      ctx.fillRect(x, y, cell, cell)
    }
  }

  ctx.globalAlpha              = baseA
  ctx.globalCompositeOperation = 'source-over'
}

function drawHalftone(
  ctx: CanvasRenderingContext2D,
  boxW: number,
  boxH: number,
  t: number,
  features: AudioFeatures,
  color: string,
): void {
  const grid  = 10    // dot grid spacing in px
  const maxR  = grid * 0.46
  // Slow rotation of the halftone angle (classic print drift).
  const angle = (t * 0.04) % (Math.PI / 2)
  const baseA  = ctx.globalAlpha

  ctx.globalCompositeOperation = 'multiply'
  ctx.fillStyle = color

  // Rotate the grid around the layer centre.
  ctx.save()
  ctx.rotate(angle)

  // Cover a rotated bounding box to avoid gaps at corners.
  const diag = Math.ceil(Math.sqrt(boxW * boxW + boxH * boxH) / 2) + grid
  for (let x = -diag; x < diag; x += grid) {
    for (let y = -diag; y < diag; y += grid) {
      // Dot radius modulated by audio + position hash.
      const v  = Math.abs(Math.sin(x * 0.137 + y * 0.259 + t * 0.05))
      const r  = maxR * (v * 0.7 + features.beat * 0.3)
      ctx.globalAlpha = baseA * (0.25 + features.beat * 0.15)
      ctx.beginPath()
      ctx.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2)
      ctx.fill()
    }
  }

  ctx.restore()
  ctx.globalAlpha              = baseA
  ctx.globalCompositeOperation = 'source-over'
}

// ── Renderer ──────────────────────────────────────────────────────────────────

export const textureRenderer: CanvasLayerRenderer = {
  kind: 'texture',
  draw({ ctx, layer, boxW, boxH, timeMs, features }: CanvasRenderArgs): void {
    const kind  = String(layer.settings.textureKind ?? 'scanlines')
    const color = String(layer.settings.color       ?? '#ffffff')
    const t     = timeMs / 1000

    switch (kind) {
      case 'scanlines': drawScanlines(ctx, boxW, boxH, t, features, color); break
      case 'paper':     drawPaperGrain(ctx, boxW, boxH, t, features, color); break
      case 'halftone':  drawHalftone(ctx, boxW, boxH, t, features, color);  break
      default:          drawScanlines(ctx, boxW, boxH, t, features, color)
    }
  },
}
