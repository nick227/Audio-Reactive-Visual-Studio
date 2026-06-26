import { useCallback, useState } from 'react'
import { createDefaultProject } from '../../project/defaultProject'
import type { Project } from '../../project/types'
import {
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

  const switchToProject = useCallback((id: string) => {
    if (id === project.id) return
    saveProjectToLibrary(project)
    const loaded = loadProjectById(id)
    if (!loaded) return
    onBeforeSwitch()
    setActiveProjectId(id)
    resetHistory(loaded)
    onAfterSwitch(loaded)
    refreshProjects()
  }, [onAfterSwitch, onBeforeSwitch, project, refreshProjects, resetHistory])

  const createProject = useCallback(() => {
    saveProjectToLibrary(project)
    const fresh = createDefaultProject()
    registerProject(fresh)
    onBeforeSwitch()
    resetHistory(fresh)
    onAfterSwitch(fresh)
    refreshProjects()
  }, [onAfterSwitch, onBeforeSwitch, project, refreshProjects, resetHistory])

  return {
    projects,
    activeProjectId: project.id,
    switchToProject,
    createProject,
    refreshProjects,
  }
}
