import type { AssetTemplate, LayerInstance } from './types'
import { createEntityId, nowIso } from '../entities/entityTypes'

export function createLayerFromTemplate(template: AssetTemplate, overrides: Partial<LayerInstance> = {}): LayerInstance {
  const timestamp = nowIso()
  const base: LayerInstance = {
    id: createEntityId('layer'),
    kind: 'layer',
    createdAt: timestamp,
    updatedAt: timestamp,
    templateId: template.id,
    name: template.name,
    visible: true,
    locked: false,
    placement: {
      fit: 'contain',
      x: 0,
      y: 0,
      scale: 1,
      rotation: 0,
      opacity: 1,
      anchor: 'center',
    },
    reaction: {
      trigger: 'bass',
      pulseAmount: 0.25,
      extraEffect: 'none',
      extraAmount: 0.25,
      smoothness: 0.22,
    },
    settings: {},
  }

  return {
    ...base,
    ...template.defaultLayer,
    ...overrides,
    placement: {
      ...base.placement,
      ...template.defaultLayer.placement,
      ...overrides.placement,
    },
    reaction: {
      ...base.reaction,
      ...template.defaultLayer.reaction,
      ...overrides.reaction,
    },
    settings: {
      ...base.settings,
      ...template.defaultLayer.settings,
      ...overrides.settings,
    },
    updatedAt: nowIso(),
  }
}
