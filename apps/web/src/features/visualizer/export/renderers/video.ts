import type { LayerInstance } from '../../project/types'
import type { CanvasLayerRenderer, CanvasRenderArgs } from './types'
import { drawImageFitted } from './drawUtils'

// ── Lifecycle helpers (exported for VisualizerEditor) ─────────────────────────

export function createExportVideoElements(
  layers: LayerInstance[],
): Map<string, HTMLVideoElement> {
  const map = new Map<string, HTMLVideoElement>()
  for (const layer of layers) {
    if (layer.templateId !== 'video-layer') continue
    const src = String(layer.settings.src ?? '')
    if (!src) continue
    const el = document.createElement('video')
    el.muted      = true
    el.playsInline = true
    el.preload    = 'auto'
    el.src        = src
    map.set(layer.id, el)
  }
  return map
}

export function disposeExportVideoElements(map: Map<string, HTMLVideoElement>): void {
  for (const el of map.values()) {
    el.pause()
    el.removeAttribute('src')
    el.load()
  }
  map.clear()
}

// ── Seek helpers ──────────────────────────────────────────────────────────────

function videoPositionMs(layer: LayerInstance, projectTimeMs: number): number {
  const startMs = Number(layer.settings.videoStartMs ?? 0)
  const endMs   = layer.settings.videoEndMs != null ? Number(layer.settings.videoEndMs) : null
  const rate    = Number(layer.settings.playbackRate ?? 1)
  const loop    = layer.settings.videoLoop !== false
  let t = startMs + projectTimeMs * rate
  if (endMs != null && t >= endMs) {
    if (loop) {
      const span = endMs - startMs
      t = span > 0 ? startMs + ((t - startMs) % span) : startMs
    } else {
      t = endMs
    }
  }
  return Math.max(0, t)
}

async function seekVideo(el: HTMLVideoElement, ms: number): Promise<void> {
  if (el.readyState === 0) {
    await new Promise<void>((resolve) => {
      el.addEventListener('loadedmetadata', () => resolve(), { once: true })
      el.addEventListener('error', () => resolve(), { once: true })
    })
  }
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, 2000)
    const done  = () => { clearTimeout(timer); resolve() }
    el.currentTime = ms / 1000
    if (el.seeking) {
      el.addEventListener('seeked', done, { once: true })
    } else {
      done()
    }
  })
}

// ── Renderer ──────────────────────────────────────────────────────────────────

export const videoRenderer: CanvasLayerRenderer = {
  kind: 'video',
  async draw({ ctx, layer, videoEls, boxW, boxH, timeMs }: CanvasRenderArgs): Promise<void> {
    const el = videoEls.get(layer.id)
    if (!el) return
    await seekVideo(el, videoPositionMs(layer, timeMs))
    if (el.readyState >= 2) {
      drawImageFitted(ctx, el, el.videoWidth, el.videoHeight, boxW, boxH, layer.placement.fit)
    }
  },
}
