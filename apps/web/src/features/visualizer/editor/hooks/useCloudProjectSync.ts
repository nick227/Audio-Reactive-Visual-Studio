import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useCreateProject, useCurrentUser, useUpdateProject } from '@avl/sdk'
import type { Project } from '../../project/types'

export function useCloudProjectSync(project: Project) {
  const { data: meData } = useCurrentUser()
  const me = meData?.data ?? null
  const createProject = useCreateProject()
  const updateProject = useUpdateProject()
  const [cloudProjectId, setCloudProjectId] = useState<string | null>(() =>
    localStorage.getItem('avl.cloud-project-id')
  )
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<string | null>(null)

  const cloudDirtyRef = useRef(false)
  const lastAutoCloudSaveRef = useRef(cloudProjectId ? Date.now() : 0)
  const projectRef = useRef(project)
  projectRef.current = project

  const prevUserIdRef = useRef<string | null | undefined>(undefined)
  useEffect(() => {
    const userId = me?.id ?? null
    if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
      setCloudProjectId(null)
      setLastSaved(null)
      localStorage.removeItem('avl.cloud-project-id')
    }
    prevUserIdRef.current = userId
  }, [me?.id])

  const handleSaveToCloud = useCallback(async () => {
    if (!me) return
    setIsSaving(true)
    try {
      const doc = JSON.parse(JSON.stringify(projectRef.current))
      if (cloudProjectId) {
        await updateProject.mutateAsync({ id: cloudProjectId, title: projectRef.current.name, documentJson: doc })
      } else {
        const saved = await createProject.mutateAsync({
          title: projectRef.current.name,
          documentJson: doc,
          schemaVersion: projectRef.current.schemaVersion,
        })
        setCloudProjectId(saved.id)
        localStorage.setItem('avl.cloud-project-id', saved.id)
      }
      cloudDirtyRef.current = false
      lastAutoCloudSaveRef.current = Date.now()
      setLastSaved(new Date().toISOString())
      toast.success('Saved to cloud')
    } catch {
      toast.error('Cloud save failed')
    } finally {
      setIsSaving(false)
    }
  }, [me, cloudProjectId, createProject, updateProject])

  const handleSaveToCloudRef = useRef(handleSaveToCloud)
  handleSaveToCloudRef.current = handleSaveToCloud
  useEffect(() => {
    if (!me) return
    const iv = setInterval(() => {
      if (!cloudDirtyRef.current) return
      if (Date.now() - lastAutoCloudSaveRef.current < 5 * 60 * 1000) return
      void handleSaveToCloudRef.current()
    }, 60_000)
    return () => clearInterval(iv)
  }, [me])

  return {
    me,
    cloudDirtyRef,
    handleSaveToCloud,
    isSaving,
    lastSaved,
  }
}
