import type { AudioFeatures } from '../audio/audioTypes'
import type { LayerInstance, StageEntity } from '../project/types'
import type { ActiveMicroEffect } from './microEventEngine'
import { isLayerVisibleAtTime } from '../layers/layerVisibilityTiming'
import { computeLayerTransform } from './effects'
import { applyLayerPositionStyles } from './layerStyles'

type StageSize = Pick<StageEntity, 'width' | 'height'>

export function applyLayerFrame(
  el: HTMLElement,
  layer: LayerInstance,
  features: AudioFeatures,
  smoothedValue: number,
  time: number,
  stage: StageSize,
  microEffect?: ActiveMicroEffect,
  currentTimeMs = 0,
  durationMs = 0,
) {
  const transform = computeLayerTransform(layer, features, time, smoothedValue, microEffect)
  applyLayerPositionStyles(el, transform, stage)
  el.style.opacity = String(transform.opacity)
  el.style.filter = transform.filter
  el.style.display = isLayerVisibleAtTime(layer, currentTimeMs, durationMs) ? 'block' : 'none'
}
