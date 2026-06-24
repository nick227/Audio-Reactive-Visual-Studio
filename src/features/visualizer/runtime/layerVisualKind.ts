import type { LayerInstance } from '../project/types'
import { assetRegistry } from '../assets/registry'

export function resolveVisualKind(layer: LayerInstance): string {
  if (layer.settings.visualKind != null) return String(layer.settings.visualKind)
  return fallbackKind(layer.templateId)
}

export function isTypographyLayer(layer: LayerInstance): boolean {
  if (resolveVisualKind(layer) === 'typography') return true
  return assetRegistry.get(layer.templateId)?.category === 'typography'
}

function fallbackKind(templateId: string): string {
  switch (templateId) {
    case 'liquid-gradient': return 'gradient'
    case 'bass-rings': return 'audioVisualizer'
    case 'spark-particles': return 'particles'
    case 'chrome-frame': return 'frame'
    case 'kinetic-title': return 'typography'
    case 'vhs-noise': return 'texture'
    case 'puppet-dancer': return 'puppet'
    default: return 'unknown'
  }
}
