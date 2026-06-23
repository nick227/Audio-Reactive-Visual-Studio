import type { CSSProperties } from 'react'
import type { LayerInstance, StageEntity } from '../project/types'
import type { EffectTransform } from './effects'

type StageSize = Pick<StageEntity, 'width' | 'height'>

export function layerHostStyle(layer: LayerInstance, transform: EffectTransform, stage: StageSize): CSSProperties {
  const size = fitSize(layer)
  const position = layerPosition(transform, stage)

  return {
    position: 'absolute',
    left: `calc(50% + ${position.xPercent}%)`,
    top: `calc(50% + ${position.yPercent}%)`,
    width: size.width,
    height: size.height,
    transform: `translate(-50%, -50%) rotate(${transform.rotation}deg) scale(${transform.scale})`,
    opacity: transform.opacity,
    filter: transform.filter,
    transformOrigin: 'center center',
    pointerEvents: layer.locked ? 'none' : 'auto',
    display: layer.visible ? 'block' : 'none',
    transition: 'filter 90ms linear',
    ['--asset-object-fit' as string]: objectFit(layer),
  }
}

export function applyLayerPositionStyles(el: HTMLElement, transform: EffectTransform, stage: StageSize) {
  const position = layerPosition(transform, stage)
  el.style.left = `calc(50% + ${position.xPercent}%)`
  el.style.top = `calc(50% + ${position.yPercent}%)`
  el.style.transform = `translate(-50%, -50%) rotate(${transform.rotation}deg) scale(${transform.scale})`
}

function layerPosition(transform: EffectTransform, stage: StageSize) {
  return {
    xPercent: (transform.x / stage.width) * 100,
    yPercent: (transform.y / stage.height) * 100,
  }
}

function objectFit(layer: LayerInstance) {
  if (layer.placement.fit === 'cover') return 'cover'
  if (layer.placement.fit === 'stretch') return 'fill'
  return 'contain'
}

function fitSize(layer: LayerInstance): Pick<CSSProperties, 'width' | 'height'> {
  switch (layer.placement.fit) {
    case 'cover':
    case 'stretch':
      return { width: '100%', height: '100%' }
    case 'original':
      return { width: 'auto', height: 'auto' }
    case 'custom':
    case 'contain':
    default:
      return { width: '74%', height: '74%' }
  }
}
