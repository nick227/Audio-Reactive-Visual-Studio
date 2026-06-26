import { useCallback, useState } from 'react'
import { createDefaultProject } from '../../project/defaultProject'
import type { Project } from '../../project/types'
import { idbDelete } from '../../storage/idbStorage'
import {
  deleteProjectFromLibrary,
  duplicateProjectInLibrary,
  listProjects,
  loadProjectById,
  registerProject,
  saveProjectToLibrary,
  setActiveProjectId,
  type ProjectIndexEntry,
} from '../../project/projectLibrary'

type UseProjectLibraryParams = {
  project: Project
  resetHistory: (present: Project) => void
  onBeforeSwitch: () => void
  onAfterSwitch: (next: Project) => void
}

export function useProjectLibrary({
  project,
  resetHistory,
  onBeforeSwitch,
  onAfterSwitch,
}: UseProjectLibraryParams) {
  const [projects, setProjects] = useState<ProjectIndexEntry[]>(() => listProjects())

  const refreshProjects = useCallback(() => {
    setProjects(listProjects())
  }, [])

  const activateProject = useCallback((next: Project) => {
    onBeforeSwitch()
    resetHistory(next)
    onAfterSwitch(next)
    refreshProjects()
  }, [onAfterSwitch, onBeforeSwitch, refreshProjects, resetHistory])

  const switchToProject = useCallback((id: string) => {
    if (id === project.id) return
    saveProjectToLibrary(project)
    const loaded = loadProjectById(id)
    if (!loaded) return
    setActiveProjectId(id)
    activateProject(loaded)
  }, [activateProject, project])

  const createProject = useCallback(() => {
    saveProjectToLibrary(project)
    const fresh = createDefaultProject()
    registerProject(fresh)
    activateProject(fresh)
  }, [activateProject, project])

  const duplicateProject = useCallback((id: string) => {
    saveProjectToLibrary(project)
    const source = id === project.id ? project : loadProjectById(id)
    if (!source) return
    const copy = duplicateProjectInLibrary(source)
    activateProject(copy)
  }, [activateProject, project])

  const deleteProject = useCallback(async (id: string) => {
    if (id !== project.id) saveProjectToLibrary(project)
    const result = await deleteProjectFromLibrary(id, idbDelete)
    if (!result.removed) return
    if (result.switched && result.next) activateProject(result.next)
    else refreshProjects()
  }, [activateProject, project, refreshProjects])

  return {
    projects,
    activeProjectId: project.id,
    switchToProject,
    createProject,
    duplicateProject,
    deleteProject,
    refreshProjects,
  }
}
