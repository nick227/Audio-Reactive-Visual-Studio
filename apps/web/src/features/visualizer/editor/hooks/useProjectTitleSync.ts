import { useEffect, useRef } from 'react'
import { useCreateProject, useCurrentUser, useUpdateProject } from '@avl/sdk'
import type { Project } from '../../project/types'
import { createDefaultProject } from '../../project/defaultProject'

const MAP_KEY = 'avl.cloud-project-map.v1'
const SYNC_DEBOUNCE_MS = 2000

type CloudProjectMap = Record<string, string>
type SyncedTitle = { projectId: string; title: string }

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
  const userId = meData?.data?.id
  const createProject = useCreateProject()
  const updateProject = useUpdateProject()
  const projectRef = useRef(project)
  projectRef.current = project

  const createProjectAsyncRef = useRef(createProject.mutateAsync)
  createProjectAsyncRef.current = createProject.mutateAsync
  const updateProjectAsyncRef = useRef(updateProject.mutateAsync)
  updateProjectAsyncRef.current = updateProject.mutateAsync

  const lastSyncedRef = useRef<SyncedTitle | null>(null)
  const prevUserIdRef = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    const nextUserId = userId ?? null
    if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== nextUserId) {
      writeMap({})
      lastSyncedRef.current = null
    }
    prevUserIdRef.current = nextUserId
  }, [userId])

  useEffect(() => {
    if (!userId) return

    const timer = window.setTimeout(() => {
      void (async () => {
        const current = projectRef.current
        const last = lastSyncedRef.current
        if (last?.projectId === current.id && last.title === current.name) return

        const map = readMap()
        const cloudId = map[current.id]
        try {
          if (cloudId) {
            await updateProjectAsyncRef.current({ id: cloudId, title: current.name })
          } else {
            const saved = await createProjectAsyncRef.current({
              title: current.name,
              documentJson: titleOnlyStub(current),
              schemaVersion: current.schemaVersion,
            })
            writeMap({ ...map, [current.id]: saved.id })
          }
          lastSyncedRef.current = { projectId: current.id, title: current.name }
        } catch {
          // Silent — local editing does not depend on cloud sync.
        }
      })()
    }, SYNC_DEBOUNCE_MS)

    return () => window.clearTimeout(timer)
  }, [userId, project.id, project.name])
}
