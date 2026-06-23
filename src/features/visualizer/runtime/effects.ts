import type { AudioFeatures } from '../audio/audioTypes'
import type { AudioTrigger, ExtraEffect, LayerInstance } from '../project/types'
import type { ActiveMicroEffect } from './microEventEngine'

export type EffectTransform = {
  x: number
  y: number
  scale: number
  rotation: number
  opacity: number
  filter: string
}

export function audioValue(features: AudioFeatures, trigger: AudioTrigger): number {
  if (trigger === 'none') return 0
  return features[trigger]
}

export function computeLayerTransform(
  layer: LayerInstance,
  features: AudioFeatures,
  time: number,
  smoothedValue?: number,
  microEffect?: ActiveMicroEffect,
): EffectTransform {
  const value = smoothedValue ?? audioValue(features, layer.reaction.trigger)
  const pulse = 1 + value * layer.reaction.pulseAmount
  const extra = computeExtra(layer.reaction.extraEffect, layer.reaction.extraAmount, features, time)

  const base: EffectTransform = {
    x: layer.placement.x + extra.x,
    y: layer.placement.y + extra.y,
    scale: layer.placement.scale * pulse * extra.scale,
    rotation: layer.placement.rotation + extra.rotation,
    opacity: layer.placement.opacity * extra.opacity,
    filter: extra.filter,
  }

  return microEffect ? applyMicroEffect(base, microEffect, time) : base
}

function computeExtra(effect: ExtraEffect, amount: number, features: AudioFeatures, time: number): EffectTransform {
  const base: EffectTransform = { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, filter: '' }
  const t = time / 1000
  const full = features.full
  const highs = features.highs
  const beat = features.beat

  switch (effect) {
    case 'float':
      return { ...base, y: Math.sin(t * 1.4) * 18 * amount - full * 12 * amount }
    case 'rotate':
      return { ...base, rotation: Math.sin(t * 0.8) * 8 * amount + beat * 7 * amount }
    case 'drift':
      return { ...base, x: Math.sin(t * 0.55) * 24 * amount, y: Math.cos(t * 0.4) * 20 * amount }
    case 'shake':
      // Deterministic band-limited noise — smooth and beat-driven, no Math.random()
      return {
        ...base,
        x: Math.sin(t * 43.7) * beat * 28 * amount,
        y: Math.cos(t * 37.3) * beat * 28 * amount,
      }
    case 'glow':
      return { ...base, filter: `brightness(${1 + highs * amount * 1.8}) drop-shadow(0 0 ${Math.round(24 * highs * amount)}px rgba(255,255,255,.75))` }
    case 'flicker':
      return { ...base, opacity: Math.max(0.15, 1 - highs * amount * 0.7 + Math.sin(t * 97.3) * highs * amount * 0.3) }
    case 'particles':
      return { ...base, filter: `brightness(${1 + features.highs * amount})` }
    default:
      return base
  }
}

function applyMicroEffect(base: EffectTransform, micro: ActiveMicroEffect, time: number): EffectTransform {
  const decay = 1 - micro.progress
  const t = time / 1000

  switch (micro.effect) {
    case 'flash':
      return { ...base, filter: joinFilters(base.filter, `brightness(${(1 + decay * 2.8).toFixed(2)})`) }
    case 'burst':
      return { ...base, scale: base.scale * (1 + decay * 0.2) }
    case 'jitter': {
      const amp = decay * 16
      return { ...base, x: base.x + Math.sin(t * 61) * amp, y: base.y + Math.cos(t * 53) * amp }
    }
    case 'invert':
      return decay > 0.5 ? { ...base, filter: joinFilters(base.filter, 'invert(1)') } : base
    case 'wipe':
      return { ...base, filter: joinFilters(base.filter, `brightness(${(1 + decay * 1.8).toFixed(2)}) contrast(${(1 + decay * 0.6).toFixed(2)})`) }
    case 'duplicate':
      return { ...base, filter: joinFilters(base.filter, `drop-shadow(6px 6px 0 rgba(255,0,220,${(decay * 0.9).toFixed(2)}))`) }
    default:
      return base
  }
}

function joinFilters(a: string, b: string): string {
  return a ? `${a} ${b}` : b
}
