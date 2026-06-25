import type { LayerInstance } from '../../project/types'
import type { AudioFeatures } from '../../audio/audioTypes'

// motionEffect layers are full-frame compositing modifiers, not positional shapes.
// They receive no translate/rotate/scale — they operate on the full canvas in the
// default (top-left origin) coordinate system and use blend modes to modify what's
// already been drawn.

export function applyMotionEffectModifier(
  ctx: CanvasRenderingContext2D,
  layer: LayerInstance,
  features: AudioFeatures,
  W: number,
  H: number,
  timeMs: number,
): void {
  const effectKind = String(layer.settings.effectKind ?? 'glitch')
  const color      = String(layer.settings.color      ?? '#ffffff')
  const t          = timeMs / 1000
  const { beat, highs, bass, full } = features

  switch (effectKind) {
    case 'glitch':     applyGlitch(ctx, W, H, t, beat, color); break
    case 'rgb':        applyRgb(ctx, W, H, t, beat);           break
    case 'bloom':      applyBloom(ctx, W, H, t, full, color);  break
    case 'zoom-lines': applyZoomLines(ctx, W, H, t, beat);     break
    case 'roll':       applyRoll(ctx, W, H, t, beat);          break
    case 'lightning':  applyLightning(ctx, W, H, t, beat, color); break
    case 'portal':     applyPortal(ctx, W, H, t, bass, color); break
    case 'dream':      applyDream(ctx, W, H, t, full, color);  break
  }
  // Keep highs in the union so TypeScript doesn't warn about unused variable.
  void highs
}

// ── Effect implementations ────────────────────────────────────────────────────
// Each save/restore pair is self-contained; callers own the outer state.

function applyGlitch(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  t: number,
  beat: number,
  _color: string,
): void {
  if (beat < 0.06) return
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  const blockCount = Math.floor(3 + beat * 8)
  for (let i = 0; i < blockCount; i++) {
    const y  = (Math.sin(t * 37 + i * 7.3) * 0.5 + 0.5) * H
    const h  = 1 + Math.abs(Math.sin(i * 11.7 + t * 5)) * 20 * beat
    const ox = Math.sin(t * 29 + i * 3.1) * 40 * beat
    ctx.fillStyle = `rgba(255,0,0,${(beat * 0.4).toFixed(2)})`
    ctx.fillRect(ox, y,          W, h)
    ctx.fillStyle = `rgba(0,255,255,${(beat * 0.25).toFixed(2)})`
    ctx.fillRect(-ox, y + h * 0.4, W, h * 0.6)
  }
  ctx.restore()
}

function applyRgb(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  _t: number,
  beat: number,
): void {
  if (beat < 0.06) return
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  const ox = Math.round(6 + beat * 22)
  ctx.fillStyle = `rgba(255,0,0,${(beat * 0.35).toFixed(2)})`
  ctx.fillRect(ox, 0, W, H)
  ctx.fillStyle = `rgba(0,0,255,${(beat * 0.35).toFixed(2)})`
  ctx.fillRect(-ox, 0, W, H)
  ctx.restore()
}

function applyBloom(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  _t: number,
  full: number,
  _color: string,
): void {
  if (full < 0.04) return
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  ctx.fillStyle = `rgba(255,240,255,${(full * 0.32).toFixed(2)})`
  ctx.fillRect(0, 0, W, H)
  ctx.restore()
}

function applyZoomLines(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  t: number,
  beat: number,
): void {
  if (beat < 0.06) return
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  ctx.strokeStyle = `rgba(255,255,255,${(beat * 0.55).toFixed(2)})`
  ctx.lineWidth   = 1
  const cx         = W / 2
  const cy         = H / 2
  const lineCount  = Math.floor(16 + beat * 24)
  for (let i = 0; i < lineCount; i++) {
    const angle = (i / lineCount) * Math.PI * 2 + t * 0.5
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(angle) * W * 0.05, cy + Math.sin(angle) * H * 0.05)
    ctx.lineTo(cx + Math.cos(angle) * W * 0.9,  cy + Math.sin(angle) * H * 0.9)
    ctx.stroke()
  }
  ctx.restore()
}

function applyRoll(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  t: number,
  beat: number,
): void {
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  const bandY = ((t * 120 + beat * H * 0.4) % H + H) % H
  const bandH = 4 + beat * 16
  const alpha = (0.12 + beat * 0.32).toFixed(2)
  ctx.fillStyle = `rgba(255,255,255,${alpha})`
  ctx.fillRect(0, bandY,     W, bandH)
  ctx.fillRect(0, bandY - H, W, bandH)
  ctx.restore()
}

function applyLightning(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  t: number,
  beat: number,
  color: string,
): void {
  if (beat < 0.18) return
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  ctx.globalAlpha *= beat
  ctx.strokeStyle  = color
  ctx.lineWidth    = 1 + beat * 3
  let x = W * (0.3 + Math.sin(t * 13) * 0.4)
  let y = 0
  ctx.beginPath()
  ctx.moveTo(x, y)
  while (y < H) {
    y += H / 8
    x += Math.sin(t * 29 + y * 0.1) * 80 * beat
    x  = Math.max(0, Math.min(W, x))
    ctx.lineTo(x, y)
  }
  ctx.stroke()
  ctx.restore()
}

function applyPortal(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  t: number,
  bass: number,
  color: string,
): void {
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  ctx.translate(W / 2, H / 2)
  ctx.rotate(t * (0.3 + bass * 0.5))
  const r    = Math.min(W, H) * (0.28 + bass * 0.16)
  const grad = ctx.createRadialGradient(0, 0, r * 0.08, 0, 0, r)
  grad.addColorStop(0, `rgba(255,255,255,${(0.3 + bass * 0.4).toFixed(2)})`)
  grad.addColorStop(0.55, color)
  grad.addColorStop(1, 'transparent')
  ctx.fillStyle = grad
  ctx.fillRect(-W / 2, -H / 2, W, H)
  ctx.restore()
}

function applyDream(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  _t: number,
  full: number,
  color: string,
): void {
  if (full < 0.04) return
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  const grad = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.min(W, H) * 0.5)
  grad.addColorStop(0, `rgba(255,255,255,${(full * 0.25).toFixed(2)})`)
  grad.addColorStop(0.6, color)
  grad.addColorStop(1, 'transparent')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)
  ctx.restore()
}
