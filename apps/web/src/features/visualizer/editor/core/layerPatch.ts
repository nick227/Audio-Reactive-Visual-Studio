import type { LayerInstance } from '../../project/types'
import { nowIso } from '../../entities/entityTypes'

export function applyLayerPatch(
  layers: LayerInstance[],
  layerId: string,
  patch: Partial<LayerInstance>,
): LayerInstance[] {
  return layers.map((layer) =>
    layer.id === layerId
      ? {
          ...layer,
          ...patch,
          placement: { ...layer.placement, ...patch.placement },
          reaction: { ...layer.reaction, ...patch.reaction },
          settings: { ...layer.settings, ...patch.settings },
          timing: patch.timing ?? layer.timing,
          updatedAt: nowIso(),
        }
      : layer
  )
}
