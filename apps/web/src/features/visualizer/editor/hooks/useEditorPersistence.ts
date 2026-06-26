import { useEffect, useRef, useState } from 'react'
import type { Project } from '../../project/types'
import { loadLocalSaveMeta, saveProject } from '../../project/projectPersistence'

type UseEditorPersistenceParams = {
  project: Project
}

export function useEditorPersistence({ project }: UseEditorPersistenceParams) {
  const [localSavedAt, setLocalSavedAt] = useState<string | null>(() => loadLocalSaveMeta()?.savedAt ?? null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (saveTimerRef.current !== null) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      saveProject(project)
      setLocalSavedAt(new Date().toISOString())
      saveTimerRef.current = null
    }, 400)
    return () => {
      if (saveTimerRef.current !== null) {
        clearTimeout(saveTimerRef.current)
        saveProject(project)
        setLocalSavedAt(new Date().toISOString())
        saveTimerRef.current = null
      }
    }
  }, [project])

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!project.audio && project.layers.length === 0) return
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [project])

  return { localSavedAt }
}
