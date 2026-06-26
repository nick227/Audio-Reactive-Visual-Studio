import type { Project } from './types'
import {
  getActiveProjectMeta,
  loadActiveProject,
  saveProjectToLibrary,
} from './projectLibrary'

export type LocalSaveMeta = {
  savedAt: string
  name: string
}

export function loadLocalSaveMeta(): LocalSaveMeta | null {
  const meta = getActiveProjectMeta()
  if (!meta) return null
  return { savedAt: meta.savedAt, name: meta.name }
}

export function loadSavedProject(): Project | null {
  return loadActiveProject()
}

export function saveProject(project: Project) {
  saveProjectToLibrary(project)
}

export function clearSavedProject() {
  // Kept for compatibility — active project data remains in the library index.
}

export { listProjects, type ProjectIndexEntry } from './projectLibrary'
