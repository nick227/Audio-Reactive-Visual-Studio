import type { CanvasLayerRenderer, CanvasRenderArgs } from './types'
import { approximateSpectrumAt } from '../audioAnalysis'

// ── Visualizer sub-renderers (ctx translated to layer centre) ─────────────────

function drawBars(ctx: CanvasRenderingContext2D, spectrum: Float32Array, boxW: number, boxH: number): void {
  const n    = spectrum.length
  const slot = boxW / n
  const barW = slot * 0.75
  const gap  = slot * 0.25
  for (let i = 0; i < n; i++) {
    const h = spectrum[i] * boxH
    const x = -boxW / 2 + i * slot + gap / 2
    ctx.fillRect(x, boxH / 2 - h, barW, h)
  }
}

function drawRadial(ctx: CanvasRenderingContext2D, spectrum: Float32Array, boxW: number, boxH: number): void {
  const n    = spectrum.length
  const r0   = Math.min(boxW, boxH) * 0.18
  const rMax = Math.min(boxW, boxH) * 0.44
  ctx.lineWidth = 2
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2
    const r     = r0 + spectrum[i] * (rMax - r0)
    ctx.beginPath()
    ctx.moveTo(Math.cos(angle) * r0, Math.sin(angle) * r0)
    ctx.lineTo(Math.cos(angle) * r,  Math.sin(angle) * r)
    ctx.stroke()
  }
}

function drawRings(ctx: CanvasRenderingContext2D, spectrum: Float32Array, boxW: number, boxH: number): void {
  const rMax      = Math.min(boxW, boxH) * 0.46
  const ringCount = Math.min(6, spectrum.length)
  const baseAlpha = ctx.globalAlpha
  for (let i = 0; i < ringCount; i++) {
    const v    = spectrum[Math.floor((i / ringCount) * spectrum.length)] ?? 0
    const base = (i + 1) / (ringCount + 1)
    const r    = rMax * (base + v * 0.18)
    ctx.globalAlpha = baseAlpha * (0.35 + v * 0.65)
    ctx.lineWidth   = 1 + v * 3
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.globalAlpha = baseAlpha
}

function drawRibbon(ctx: CanvasRenderingContext2D, spectrum: Float32Array, boxW: number, boxH: number): void {
  const n     = spectrum.length
  const halfH = boxH * 0.38
  ctx.lineWidth = 2
  ctx.beginPath()
  for (let i = 0; i < n; i++) {
    const x = -boxW / 2 + (i / (n - 1)) * boxW
    const y = (spectrum[i] - 0.5) * halfH
    if (i === 0) ctx.moveTo(x, y)
    else         ctx.lineTo(x, y)
  }
  ctx.stroke()
}

// ── Renderer ──────────────────────────────────────────────────────────────────

export const audioVisualizerRenderer: CanvasLayerRenderer = {
  kind: 'audioVisualizer',
  draw({ ctx, layer, renderCtx, boxW, boxH, timeMs }: CanvasRenderArgs): void {
    const { audioAnalysis, fps } = renderCtx
    const color = String(layer.settings.color          ?? '#ffffff')
    const kind  = String(layer.settings.visualizerKind ?? 'bars')
    const bars  = Math.max(12, Math.min(96, Number(layer.settings.bars ?? 48)))

    const frameIdx = audioAnalysis
      ? Math.min(Math.floor((timeMs / 1000) * fps), audioAnalysis.rmsPerFrame.length - 1)
      : 0
    const spectrum = audioAnalysis
      ? approximateSpectrumAt(audioAnalysis, frameIdx, bars)
      : new Float32Array(bars)

    ctx.fillStyle   = color
    ctx.strokeStyle = color

    switch (kind) {
      case 'bars':   drawBars(ctx, spectrum, boxW, boxH);   break
      case 'radial': drawRadial(ctx, spectrum, boxW, boxH); break
      case 'rings':  drawRings(ctx, spectrum, boxW, boxH);  break
      case 'ribbon': drawRibbon(ctx, spectrum, boxW, boxH); break
      default:       drawBars(ctx, spectrum, boxW, boxH)
    }
  },
}
