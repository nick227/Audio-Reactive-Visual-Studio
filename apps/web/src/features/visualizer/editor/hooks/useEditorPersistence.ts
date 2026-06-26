import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { Project } from '../../project/types'
import { loadLocalSaveMeta, saveProject } from '../../project/projectPersistence'

type UseEditorPersistenceParams = {
  project: Project
  cloudDirtyRef: RefObject<boolean>
}

export function useEditorPersistence({ project, cloudDirtyRef }: UseEditorPersistenceParams) {
  const [localSavedAt, setLocalSavedAt] = useState<string | null>(() => loadLocalSaveMeta()?.savedAt ?? null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    cloudDirtyRef.current = true
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
  }, [cloudDirtyRef, project])

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
