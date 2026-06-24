import type { Project } from './types'
import { createEntityId, nowIso } from '../entities/entityTypes'

export function createDefaultProject(): Project {
  const timestamp = nowIso()

  return {
    id: createEntityId('project'),
    kind: 'project',
    schemaVersion: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    name: 'Untitled Visualizer',
    stage: {
      id: createEntityId('stage'),
      kind: 'stage',
      createdAt: timestamp,
      updatedAt: timestamp,
      width: 1920,
      height: 1080,
      preset: 'desktop',
      backgroundColor: '#101014',
    },
    layers: [],
  }
}
