import type { AudioFeatures } from '../audio/audioTypes'
import { silentAudioFeatures } from '../audio/audioTypes'
import type { FitMode } from '../project/types'
import { PuppetLayerRuntime } from '../puppets/PuppetLayerRuntime'

type HostedLayer = {
  runtime: PuppetLayerRuntime
  settingsKey: string
}

class PuppetRuntimeHost {
  private readonly layers = new Map<string, HostedLayer>()
  private features: AudioFeatures = silentAudioFeatures
  private rafId: number | null = null
  private lastTime = 0

  attach(layerId: string, canvas: HTMLCanvasElement, settings: Record<string, unknown>) {
    canvas.dataset.layerId = layerId
    const existing = this.layers.get(layerId)
    if (existing) {
      existing.runtime.dispose()
    }
    const runtime = new PuppetLayerRuntime(layerId, canvas, settings)
    this.layers.set(layerId, { runtime, settingsKey: JSON.stringify(settings) })
    this.resizeLayer(layerId, canvas)
    this.ensureLoop()
  }

  updateSettings(layerId: string, settings: Record<string, unknown>) {
    const hosted = this.layers.get(layerId)
    if (!hosted) return
    const nextKey = JSON.stringify(settings)
    if (nextKey === hosted.settingsKey) return
    hosted.runtime.updateSettings(settings)
    hosted.settingsKey = nextKey
  }

  resizeLayer(layerId: string, canvas: HTMLCanvasElement) {
    const hosted = this.layers.get(layerId)
    if (!hosted) return
    const width = canvas.clientWidth || canvas.getBoundingClientRect().width
    const height = canvas.clientHeight || canvas.getBoundingClientRect().height
    hosted.runtime.resize(width, height)
  }

  updatePlacement(layerId: string, fit: FitMode) {
    const hosted = this.layers.get(layerId)
    if (!hosted) return
    hosted.runtime.updatePlacement(fit)
  }

  detach(layerId: string) {
    const hosted = this.layers.get(layerId)
    if (!hosted) return
    hosted.runtime.dispose()
    this.layers.delete(layerId)
    if (this.layers.size === 0) this.stopLoop()
  }

  setFeatures(features: AudioFeatures) {
    this.features = features
  }

  tickAll(deltaMs: number, features?: AudioFeatures) {
    if (features) this.features = features
    for (const hosted of this.layers.values()) {
      hosted.runtime.tick(this.features, deltaMs)
    }
  }

  private ensureLoop() {
    if (this.rafId !== null) return
    this.lastTime = performance.now()
    const loop = (time: number) => {
      const delta = Math.min(48, time - this.lastTime)
      this.lastTime = time
      this.tickAll(delta)
      this.rafId = requestAnimationFrame(loop)
    }
    this.rafId = requestAnimationFrame(loop)
  }

  private stopLoop() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }
}

export const puppetRuntimeHost = new PuppetRuntimeHost()
