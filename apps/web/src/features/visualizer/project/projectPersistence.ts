import type { LayerInstance, Project } from './types'

const STORAGE_KEY = 'audio-visual-layer.project.v1'
const META_KEY = 'audio-visual-layer.meta.v1'

export type LocalSaveMeta = {
  savedAt: string
  name: string
}

export function loadLocalSaveMeta(): LocalSaveMeta | null {
  try {
    const raw = window.localStorage.getItem(META_KEY)
    return raw ? (JSON.parse(raw) as LocalSaveMeta) : null
  } catch {
    return null
  }
}

export function loadSavedProject(): Project | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Project
    if (parsed?.kind !== 'project' || parsed.schemaVersion !== 1) return null
    return parsed
  } catch {
    return null
  }
}

export function saveProject(project: Project) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stripRuntimeBlobUrls(project)))
    window.localStorage.setItem(META_KEY, JSON.stringify({ savedAt: new Date().toISOString(), name: project.name } satisfies LocalSaveMeta))
  } catch {
    // Storage can fail in private browsing or if quota is exceeded.
  }
}

export function clearSavedProject() {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
    window.localStorage.removeItem(META_KEY)
  } catch {
    // ignore
  }
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
    settings: {
      ...layer.settings,
      src: '',
    },
  }
}
