import { useEffect, useRef } from 'react'
import { useCreateProject, useCurrentUser, useUpdateProject } from '@avl/sdk'
import type { Project } from '../../project/types'
import { createDefaultProject } from '../../project/defaultProject'

const MAP_KEY = 'avl.cloud-project-map.v1'

type CloudProjectMap = Record<string, string>

function readMap(): CloudProjectMap {
  try {
    const raw = localStorage.getItem(MAP_KEY)
    return raw ? (JSON.parse(raw) as CloudProjectMap) : {}
  } catch {
    return {}
  }
}

function writeMap(map: CloudProjectMap) {
  localStorage.setItem(MAP_KEY, JSON.stringify(map))
}

function titleOnlyStub(project: Project): Project {
  const base = createDefaultProject()
  return {
    ...base,
    id: project.id,
    name: project.name,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    layers: [],
  }
}

/** Syncs project titles to the user's cloud account — metadata only, no document or media. */
export function useProjectTitleSync(project: Project) {
  const { data: meData } = useCurrentUser()
  const me = meData?.data ?? null
  const createProject = useCreateProject()
  const updateProject = useUpdateProject()
  const projectRef = useRef(project)
  projectRef.current = project

  const prevUserIdRef = useRef<string | null | undefined>(undefined)
  useEffect(() => {
    const userId = me?.id ?? null
    if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
      writeMap({})
    }
    prevUserIdRef.current = userId
  }, [me?.id])

  useEffect(() => {
    if (!me) return
    const timer = window.setTimeout(() => {
      void (async () => {
        const current = projectRef.current
        const map = readMap()
        const cloudId = map[current.id]
        try {
          if (cloudId) {
            await updateProject.mutateAsync({ id: cloudId, title: current.name })
            return
          }
          const saved = await createProject.mutateAsync({
            title: current.name,
            documentJson: titleOnlyStub(current),
            schemaVersion: current.schemaVersion,
          })
          writeMap({ ...map, [current.id]: saved.id })
        } catch {
          // Silent — local editing does not depend on cloud sync.
        }
      })()
    }, 2000)
    return () => window.clearTimeout(timer)
  }, [me, project.id, project.name, createProject, updateProject])
}
