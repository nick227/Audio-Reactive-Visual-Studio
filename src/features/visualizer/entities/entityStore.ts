import type { EntityBase, EntityId, EntityMap } from './entityTypes'
import { nowIso } from './entityTypes'

export function upsertEntity<T extends EntityBase>(entities: EntityMap<T>, entity: T): EntityMap<T> {
  return { ...entities, [entity.id]: { ...entity, updatedAt: nowIso() } }
}

export function patchEntity<T extends EntityBase>(entities: EntityMap<T>, id: EntityId, patch: Partial<T>): EntityMap<T> {
  const current = entities[id]
  if (!current) return entities
  return { ...entities, [id]: { ...current, ...patch, updatedAt: nowIso() } as T }
}

export function removeEntity<T extends EntityBase>(entities: EntityMap<T>, id: EntityId): EntityMap<T> {
  const next = { ...entities }
  delete next[id]
  return next
}
