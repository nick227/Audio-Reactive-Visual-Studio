import type { LayerInstance, Project } from './types'
import { createDefaultProject } from './defaultProject'

const INDEX_KEY = 'audio-visual-layer.index.v1'
const ACTIVE_KEY = 'audio-visual-layer.active-project-id.v1'
const LEGACY_PROJECT_KEY = 'audio-visual-layer.project.v1'
const LEGACY_META_KEY = 'audio-visual-layer.meta.v1'

export type ProjectIndexEntry = {
  id: string
  name: string
  updatedAt: string
  savedAt: string
}

function projectStorageKey(id: string) {
  return `audio-visual-layer.project.${id}.v1`
}

function readIndex(): ProjectIndexEntry[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as ProjectIndexEntry[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeIndex(entries: ProjectIndexEntry[]) {
  localStorage.setItem(INDEX_KEY, JSON.stringify(entries))
}

function isValidProject(parsed: unknown): parsed is Project {
  const p = parsed as Project
  return p?.kind === 'project' && p.schemaVersion === 1 && typeof p.id === 'string'
}

function stripRuntimeBlobUrls(project: Project): Project {
  return {
    ...project,
    audio: project.audio?.url.startsWith('blob:')
      ? { ...project.audio, url: '', duration: project.audio.duration ?? 0 }
      : project.audio,
    layers: project.layers.map(stripLayerRuntimeBlobUrls),
  }
}

function stripLayerRuntimeBlobUrls(layer: LayerInstance): LayerInstance {
  const src = layer.settings.src
  if (typeof src !== 'string' || !src.startsWith('blob:')) return layer
  return {
    ...layer,
    settings: { ...layer.settings, src: '' },
  }
}

function seedLibrary(project: Project, savedAt: string) {
  localStorage.setItem(projectStorageKey(project.id), JSON.stringify(stripRuntimeBlobUrls(project)))
  writeIndex([{
    id: project.id,
    name: project.name,
    updatedAt: project.updatedAt,
    savedAt,
  }])
  localStorage.setItem(ACTIVE_KEY, project.id)
}

function ensureMigrated() {
  if (localStorage.getItem(INDEX_KEY)) return

  try {
    const legacyRaw = localStorage.getItem(LEGACY_PROJECT_KEY)
    if (legacyRaw) {
      const parsed = JSON.parse(legacyRaw) as Project
      if (isValidProject(parsed)) {
        const metaRaw = localStorage.getItem(LEGACY_META_KEY)
        const savedAt = metaRaw
          ? (JSON.parse(metaRaw) as { savedAt?: string }).savedAt ?? parsed.updatedAt
          : parsed.updatedAt
        seedLibrary(parsed, savedAt)
        localStorage.removeItem(LEGACY_PROJECT_KEY)
        localStorage.removeItem(LEGACY_META_KEY)
        return
      }
    }
  } catch {
    // fall through to fresh project
  }

  const fresh = createDefaultProject()
  seedLibrary(fresh, fresh.createdAt)
}

export function listProjects(): ProjectIndexEntry[] {
  ensureMigrated()
  return readIndex().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function getActiveProjectId(): string {
  ensureMigrated()
  return localStorage.getItem(ACTIVE_KEY) ?? readIndex()[0]?.id ?? createDefaultProject().id
}

export function setActiveProjectId(id: string) {
  ensureMigrated()
  localStorage.setItem(ACTIVE_KEY, id)
}

export function loadProjectById(id: string): Project | null {
  ensureMigrated()
  try {
    const raw = localStorage.getItem(projectStorageKey(id))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Project
    return isValidProject(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function loadActiveProject(): Project {
  ensureMigrated()
  const id = getActiveProjectId()
  return loadProjectById(id) ?? createDefaultProject()
}

export function saveProjectToLibrary(project: Project) {
  ensureMigrated()
  const savedAt = new Date().toISOString()
  const stripped = stripRuntimeBlobUrls(project)
  localStorage.setItem(projectStorageKey(project.id), JSON.stringify(stripped))

  const index = readIndex()
  const entry: ProjectIndexEntry = {
    id: project.id,
    name: project.name,
    updatedAt: project.updatedAt,
    savedAt,
  }
  const existing = index.findIndex((item) => item.id === project.id)
  if (existing >= 0) index[existing] = entry
  else index.push(entry)
  writeIndex(index)
}

export function registerProject(project: Project) {
  ensureMigrated()
  saveProjectToLibrary(project)
  setActiveProjectId(project.id)
}

export function getActiveProjectMeta(): ProjectIndexEntry | null {
  ensureMigrated()
  const id = getActiveProjectId()
  return readIndex().find((item) => item.id === id) ?? null
}

/** IDB blob keys referenced by a project document (audio + layer uploads). */
export function collectProjectBlobKeys(project: Project): string[] {
  const keys = new Set<string>()
  if (project.audio?.fileKey) keys.add(project.audio.fileKey)
  for (const layer of project.layers) {
    const srcKey = layer.settings.srcKey
    if (typeof srcKey === 'string' && srcKey) keys.add(srcKey)
  }
  return Array.from(keys)
}

function collectAllReferencedBlobKeys(excludeProjectId?: string): Set<string> {
  const keys = new Set<string>()
  for (const entry of readIndex()) {
    if (entry.id === excludeProjectId) continue
    const doc = loadProjectById(entry.id)
    if (!doc) continue
    for (const key of collectProjectBlobKeys(doc)) keys.add(key)
  }
  return keys
}

/** Removes a project from the library and deletes IDB blobs no longer referenced elsewhere. */
export async function deleteProjectFromLibrary(
  id: string,
  idbDelete: (key: string) => Promise<void>,
): Promise<boolean> {
  ensureMigrated()
  const index = readIndex()
  if (!index.some((item) => item.id === id)) return false

  const doomed = loadProjectById(id)
  const stillReferenced = collectAllReferencedBlobKeys(id)
  const orphanKeys = doomed
    ? collectProjectBlobKeys(doomed).filter((key) => !stillReferenced.has(key))
    : []

  localStorage.removeItem(projectStorageKey(id))
  writeIndex(index.filter((item) => item.id !== id))

  const remaining = readIndex()
  if (getActiveProjectId() === id) {
    const nextId = remaining[0]?.id
    if (nextId) setActiveProjectId(nextId)
    else localStorage.removeItem(ACTIVE_KEY)
  }

  await Promise.all(orphanKeys.map((key) => idbDelete(key).catch(() => {})))
  return true
}
