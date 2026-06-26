import { createEntityId, nowIso } from '../entities/entityTypes'
import type { LayerInstance, Project } from './types'

function withoutBlobUrl(url: string) {
  return url.startsWith('blob:') ? '' : url
}

function cloneLayer(layer: LayerInstance, timestamp: string): LayerInstance {
  const src = layer.settings.src
  const srcKey = layer.settings.srcKey
  return {
    ...layer,
    id: createEntityId('layer'),
    createdAt: timestamp,
    updatedAt: timestamp,
    timing: layer.timing
      ? {
          ...layer.timing,
          gaps: layer.timing.gaps.map((gap) => ({
            ...gap,
            id: createEntityId('gap'),
          })),
        }
      : undefined,
    settings: {
      ...layer.settings,
      src: typeof src === 'string' ? withoutBlobUrl(src) : src,
      srcKey,
    },
  }
}

/** Deep clone project JSON with new entity ids; reuses IDB blob keys (no blob duplication). */
export function cloneProjectForDuplicate(source: Project): Project {
  const timestamp = nowIso()

  return {
    ...source,
    id: createEntityId('project'),
    kind: 'project',
    schemaVersion: 1,
    name: `${source.name} Copy`,
    createdAt: timestamp,
    updatedAt: timestamp,
    stage: {
      ...source.stage,
      id: createEntityId('stage'),
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    audio: source.audio
      ? {
          ...source.audio,
          id: createEntityId('audio-track'),
          createdAt: timestamp,
          updatedAt: timestamp,
          url: withoutBlobUrl(source.audio.url),
        }
      : undefined,
    layers: source.layers.map((layer) => cloneLayer(layer, timestamp)),
    microEvents: source.microEvents?.map((event) => ({
      ...event,
      id: createEntityId('micro'),
    })),
  }
}
