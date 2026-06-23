export type EntityId = string

export type EntityKind =
  | 'project'
  | 'stage'
  | 'layer'
  | 'asset-template'
  | 'media-asset'
  | 'audio-track'

export type EntityBase<K extends EntityKind = EntityKind> = {
  id: EntityId
  kind: K
  createdAt: string
  updatedAt: string
}

export type EntityMap<T extends EntityBase = EntityBase> = Record<EntityId, T>

export function createEntityId(prefix: string): EntityId {
  if (globalThis.crypto?.randomUUID) return `${prefix}_${globalThis.crypto.randomUUID().slice(0, 8)}`
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

export function nowIso() {
  return new Date().toISOString()
}
