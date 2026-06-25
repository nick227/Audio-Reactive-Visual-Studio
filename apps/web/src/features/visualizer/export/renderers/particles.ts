import type { CanvasLayerRenderer, CanvasRenderArgs } from './types'
import type { AudioFeatures } from '../../audio/audioTypes'

// All particle systems are fully deterministic — position and appearance are pure
// functions of (timeMs, particleIndex, audioFeatures). No random state is carried
// between frames, which is required for frame-accurate export.

// Golden angle in radians — distributes points evenly around a circle.
const GOLDEN = 2.3999632

function fract(x: number): number {
  return x - Math.floor(x)
}

// ── Particle sub-renderers (ctx translated to layer centre) ───────────────────

function drawEmbers(
  ctx: CanvasRenderingContext2D,
  n: number,
  boxW: number,
  boxH: number,
  t: number,
  features: AudioFeatures,
  color: string,
): void {
  const speed  = 0.22 + features.highs * 0.18
  const halfW  = boxW / 2
  const halfH  = boxH / 2
  const baseA  = ctx.globalAlpha

  ctx.fillStyle = color

  for (let i = 0; i < n; i++) {
    const p     = fract(t * speed + i / n)              // lifetime 0→1 (bottom→top)
    const x     = Math.sin(i * GOLDEN + t * 0.35) * halfW * 0.8
    const y     = halfH - p * boxH
    const r     = Math.max(0.5, 1.2 + (1 - p) * 4 * (1 + features.highs * 2))
    const alpha = (1 - p * 0.7) * (0.45 + features.highs * 0.55)

    ctx.globalAlpha = baseA * Math.min(1, alpha)
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = baseA
}

function drawBubbles(
  ctx: CanvasRenderingContext2D,
  n: number,
  boxW: number,
  boxH: number,
  t: number,
  features: AudioFeatures,
  color: string,
): void {
  const speed = 0.10 + features.full * 0.06
  const halfW = boxW / 2
  const halfH = boxH / 2
  const baseA = ctx.globalAlpha

  ctx.strokeStyle = color
  ctx.lineWidth   = 1

  for (let i = 0; i < n; i++) {
    const p     = fract(t * speed + i / n)
    const x     = Math.sin(i * GOLDEN + t * 0.18) * halfW * 0.72
             + Math.cos(t * 0.65 + i * 1.3) * halfW * 0.14
    const y     = halfH - p * boxH
    const r     = Math.max(1, 3 + Math.sin(i * 5.1) * 2 + features.full * 8)
    const alpha = (1 - p * 0.45) * 0.55

    ctx.globalAlpha = baseA * Math.min(1, alpha)
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.globalAlpha = baseA
}

function drawGlitter(
  ctx: CanvasRenderingContext2D,
  n: number,
  boxW: number,
  boxH: number,
  t: number,
  features: AudioFeatures,
  color: string,
): void {
  const halfW  = boxW / 2
  const halfH  = boxH / 2
  const halfR  = Math.min(halfW, halfH)
  const baseA  = ctx.globalAlpha
  const jitterW = halfW * 0.12
  const jitterH = halfH * 0.12

  ctx.fillStyle = color

  for (let i = 0; i < n; i++) {
    const θ      = i * GOLDEN
    const spread = Math.sqrt(i / n) * halfR         // Poisson disc-like coverage
    const x      = Math.cos(θ) * spread + Math.sin(t * 11.3 + i * 2.3) * jitterW
    const y      = Math.sin(θ) * spread + Math.cos(t * 9.7  + i * 1.8) * jitterH
    const twinkle = Math.pow(Math.abs(Math.sin(t * 12.3 + i * 4.7)), 3)
    const alpha   = twinkle * (0.35 + features.highs * 0.65)
    const r       = 0.8 + twinkle * 3

    ctx.globalAlpha = baseA * Math.min(1, alpha)
    ctx.fillRect(x - r / 2, y - r / 2, r, r)
  }
  ctx.globalAlpha = baseA
}

function drawLasers(
  ctx: CanvasRenderingContext2D,
  n: number,
  boxW: number,
  boxH: number,
  t: number,
  features: AudioFeatures,
  color: string,
): void {
  const halfW = boxW / 2
  const halfH = boxH / 2
  const baseA = ctx.globalAlpha

  ctx.fillStyle = color

  for (let i = 0; i < n; i++) {
    const baseY   = -halfH + (i / n) * boxH + Math.sin(t * 1.5 + i * 0.9) * 18
    const brightness = Math.abs(Math.sin(t * 3.2 + i * 0.7)) * (0.18 + features.highs * 0.82)
    const lineH   = 0.5 + features.highs * 3

    ctx.globalAlpha = baseA * Math.min(1, brightness)
    ctx.fillRect(-halfW, baseY, boxW, lineH)
  }
  ctx.globalAlpha = baseA
}

function drawShards(
  ctx: CanvasRenderingContext2D,
  n: number,
  boxW: number,
  boxH: number,
  t: number,
  features: AudioFeatures,
  color: string,
): void {
  const speed = 0.15 + features.beat * 0.12
  const halfW = boxW / 2
  const halfH = boxH / 2
  const baseA = ctx.globalAlpha

  ctx.fillStyle = color

  for (let i = 0; i < n; i++) {
    const p     = fract(t * speed + i / n)             // fall progress 0→1
    const x     = -halfW + (i / n) * boxW + Math.sin(i * 3.1 + t * 0.2) * halfW * 0.6
    const y     = -halfH + p * boxH
    const size  = Math.max(2, 4 + Math.abs(Math.sin(i * 7)) * 8 + features.bass * 16)
    const rot   = (i * GOLDEN + t * (0.3 + features.beat * 2)) % (Math.PI * 2)
    // Fade in at birth, fade out at expiry
    const alpha = (1 - Math.abs(p - 0.5) * 2) * 0.85

    ctx.globalAlpha = baseA * Math.min(1, alpha)
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(rot)
    ctx.beginPath()
    ctx.moveTo(0,           -size)
    ctx.lineTo( size * 0.7,  size * 0.5)
    ctx.lineTo(-size * 0.7,  size * 0.5)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }
  ctx.globalAlpha = baseA
}

function drawHearts(
  ctx: CanvasRenderingContext2D,
  n: number,
  boxW: number,
  boxH: number,
  t: number,
  features: AudioFeatures,
  color: string,
): void {
  const speed = 0.18 + features.vocals * 0.12
  const halfW = boxW / 2, halfH = boxH / 2
  const baseA = ctx.globalAlpha

  ctx.fillStyle = color

  for (let i = 0; i < n; i++) {
    const p    = fract(t * speed + i / n)
    const x    = Math.sin(i * GOLDEN + t * 0.25) * halfW * 0.78
    const y    = halfH - p * boxH
    const size = Math.max(2, 3 + Math.abs(Math.sin(i * 4.1)) * 8 + features.vocals * 10)
    const alpha = (1 - p * 0.65) * (0.5 + features.vocals * 0.5)

    ctx.globalAlpha = baseA * Math.min(1, alpha)
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(size / 10, size / 10)
    // Heart path centred at (0,0), unit size ≈ 10px
    ctx.beginPath()
    ctx.moveTo(0, 3)
    ctx.bezierCurveTo(-5, -2, -10, 2, -10, 6)
    ctx.bezierCurveTo(-10, 11, -5, 14, 0, 18)
    ctx.bezierCurveTo(5, 14, 10, 11, 10, 6)
    ctx.bezierCurveTo(10, 2, 5, -2, 0, 3)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }
  ctx.globalAlpha = baseA
}

function drawRain(
  ctx: CanvasRenderingContext2D,
  n: number,
  boxW: number,
  boxH: number,
  t: number,
  features: AudioFeatures,
  color: string,
): void {
  const speed  = 0.55 + features.full * 0.35
  const halfW  = boxW / 2, halfH = boxH / 2
  const baseA  = ctx.globalAlpha
  const angle  = -0.15   // slight diagonal

  ctx.strokeStyle = color
  ctx.lineWidth   = 1

  for (let i = 0; i < n; i++) {
    const p    = fract(t * speed + i / n)
    const x    = -halfW + (i / n) * boxW
    const y    = -halfH + p * boxH
    const len  = 8 + features.full * 18
    const alpha = (0.3 + features.full * 0.5) * (1 - p * 0.3)

    ctx.globalAlpha = baseA * Math.min(1, alpha)
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(angle)
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(0, len)
    ctx.stroke()
    ctx.restore()
  }
  ctx.globalAlpha = baseA
}

function drawSnow(
  ctx: CanvasRenderingContext2D,
  n: number,
  boxW: number,
  boxH: number,
  t: number,
  features: AudioFeatures,
  color: string,
): void {
  const speed = 0.07 + features.full * 0.04
  const halfW = boxW / 2, halfH = boxH / 2
  const baseA = ctx.globalAlpha

  ctx.fillStyle = color

  for (let i = 0; i < n; i++) {
    const p     = fract(t * speed + i / n)
    const sway  = Math.sin(i * GOLDEN + t * 0.4) * halfW * 0.28
             + Math.cos(t * 0.6 + i * 1.1) * halfW * 0.10
    const x     = -halfW + (i / n) * boxW + sway
    const y     = -halfH + p * boxH
    const r     = Math.max(1.5, 2 + Math.abs(Math.sin(i * 3.7)) * 4)
    const alpha = (0.45 + features.full * 0.35) * (1 - p * 0.5)

    ctx.globalAlpha = baseA * Math.min(1, alpha)
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = baseA
}

function drawFire(
  ctx: CanvasRenderingContext2D,
  n: number,
  boxW: number,
  boxH: number,
  t: number,
  features: AudioFeatures,
  color: string,
): void {
  // Fire: hot particles near the bottom, cooling as they rise. Color shifts warm→dim.
  const speed = 0.3 + features.bass * 0.2
  const halfW = boxW / 2, halfH = boxH / 2
  const baseA = ctx.globalAlpha

  for (let i = 0; i < n; i++) {
    const p    = fract(t * speed + i / n)   // 0 = just spawned (bottom), 1 = expired (top)
    const x    = Math.sin(i * GOLDEN + t * 0.5 + p) * halfW * (0.5 + p * 0.4)
    const y    = halfH * 0.6 - p * boxH * 0.9   // spawn lower-third, rise up
    const r    = Math.max(1, (1 - p) * (4 + features.bass * 14))
    // Hot particles brighter (low p = hot = bright)
    const alpha = (1 - p) * (0.6 + features.bass * 0.4)

    // Color: start warm white-orange, end as layer color
    const hot = Math.max(0, 1 - p * 2)
    ctx.fillStyle   = hot > 0.5 ? '#fff5cc' : color
    ctx.globalAlpha = baseA * Math.min(1, alpha)
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = baseA
}

function drawStars(
  ctx: CanvasRenderingContext2D,
  n: number,
  boxW: number,
  boxH: number,
  t: number,
  features: AudioFeatures,
  color: string,
): void {
  // Stars are quasi-static — they twinkle in place.
  const halfW = boxW / 2, halfH = boxH / 2
  const halfR = Math.min(halfW, halfH)
  const baseA = ctx.globalAlpha

  ctx.fillStyle = color

  for (let i = 0; i < n; i++) {
    const θ    = i * GOLDEN
    const dist = Math.sqrt((i + 0.5) / n) * halfR
    const x    = Math.cos(θ) * dist
    const y    = Math.sin(θ) * dist
    const twk  = Math.pow(Math.abs(Math.sin(t * 2.3 + i * 5.1)), 2)
    const burst = features.beat * Math.abs(Math.sin(i * 1.7 + t * 8))
    const alpha = twk * 0.7 + burst * 0.3
    const r     = 0.8 + twk * 2.5 + burst * 4

    ctx.globalAlpha = baseA * Math.min(1, alpha)
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = baseA
}

function drawSmoke(
  ctx: CanvasRenderingContext2D,
  n: number,
  boxW: number,
  boxH: number,
  t: number,
  features: AudioFeatures,
  color: string,
): void {
  const speed = 0.06 + features.full * 0.04
  const halfW = boxW / 2, halfH = boxH / 2
  const baseA = ctx.globalAlpha

  ctx.fillStyle = color

  for (let i = 0; i < n; i++) {
    const p    = fract(t * speed + i / n)
    // Drift sideways as it rises
    const sway = Math.sin(i * GOLDEN + t * 0.3 + p * 2) * halfW * 0.45
    const x    = Math.cos(i * GOLDEN) * halfW * 0.3 + sway
    const y    = halfH * 0.5 - p * boxH
    // Puff grows and fades
    const r    = Math.max(2, (3 + p * 40) * (1 + features.full * 0.3))
    const alpha = (1 - p) * 0.12 * (1 + features.full * 0.5)

    ctx.globalAlpha = baseA * Math.min(1, alpha)
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = baseA
}

// ── Renderer ──────────────────────────────────────────────────────────────────

export const particlesRenderer: CanvasLayerRenderer = {
  kind: 'particles',
  draw({ ctx, layer, boxW, boxH, timeMs, features }: CanvasRenderArgs): void {
    const color = String(layer.settings.color        ?? '#ffffff')
    const kind  = String(layer.settings.particleKind ?? 'embers')
    const n     = Math.max(12, Math.min(96, Number(layer.settings.density ?? 44)))
    const t     = timeMs / 1000

    switch (kind) {
      case 'embers':  drawEmbers(ctx, n, boxW, boxH, t, features, color);  break
      case 'bubbles': drawBubbles(ctx, n, boxW, boxH, t, features, color); break
      case 'glitter': drawGlitter(ctx, n, boxW, boxH, t, features, color); break
      case 'laser':   drawLasers(ctx, n, boxW, boxH, t, features, color);  break
      case 'shards':  drawShards(ctx, n, boxW, boxH, t, features, color);  break
      case 'hearts':  drawHearts(ctx, n, boxW, boxH, t, features, color);  break
      case 'rain':    drawRain(ctx, n, boxW, boxH, t, features, color);    break
      case 'snow':    drawSnow(ctx, n, boxW, boxH, t, features, color);    break
      case 'fire':    drawFire(ctx, n, boxW, boxH, t, features, color);    break
      case 'stars':   drawStars(ctx, n, boxW, boxH, t, features, color);   break
      case 'smoke':   drawSmoke(ctx, n, boxW, boxH, t, features, color);   break
      default:        drawEmbers(ctx, n, boxW, boxH, t, features, color)
    }
  },
}
