import { useEffect, useRef } from 'react'
import { useCreateProject, useCurrentUser, useUpdateProject } from '@avl/sdk'
import type { Project } from '../../project/types'
import { createDefaultProject } from '../../project/defaultProject'

const MAP_KEY = 'avl.cloud-project-map.v1'
const SYNCED_KEY = 'avl.cloud-title-synced.v1'
const SYNC_DEBOUNCE_MS = 500

type CloudProjectMap = Record<string, string>
type SyncedTitles = Record<string, string>
type Baseline = { userId: string; projectId: string; title: string }

let syncInFlight = false

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

function readSyncedTitles(): SyncedTitles {
  try {
    const raw = localStorage.getItem(SYNCED_KEY)
    return raw ? (JSON.parse(raw) as SyncedTitles) : {}
  } catch {
    return {}
  }
}

function writeSyncedTitle(key: string, title: string) {
  localStorage.setItem(SYNCED_KEY, JSON.stringify({ ...readSyncedTitles(), [key]: title }))
}

function syncStorageKey(userId: string, projectId: string) {
  return `${userId}:${projectId}`
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

/** Syncs project titles to cloud on explicit rename only — metadata, no document or media. */
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

  const baselineRef = useRef<Baseline | null>(null)
  const prevUserIdRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (!userId) {
      baselineRef.current = null
      prevUserIdRef.current = undefined
      return
    }

    if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
      writeMap({})
    }
    prevUserIdRef.current = userId

    const baseline = baselineRef.current
    if (!baseline || baseline.userId !== userId || baseline.projectId !== project.id) {
      baselineRef.current = { userId, projectId: project.id, title: project.name }
      return
    }

    if (baseline.title === project.name) return

    baselineRef.current = { userId, projectId: project.id, title: project.name }

    const storageKey = syncStorageKey(userId, project.id)
    if (readSyncedTitles()[storageKey] === project.name) return

    const timer = window.setTimeout(() => {
      void (async () => {
        const current = projectRef.current
        if (!userId) return

        const key = syncStorageKey(userId, current.id)
        if (readSyncedTitles()[key] === current.name || syncInFlight) return

        syncInFlight = true
        try {
          const map = readMap()
          const cloudId = map[current.id]
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
          writeSyncedTitle(key, current.name)
        } catch {
          // Silent — local editing does not depend on cloud sync.
        } finally {
          syncInFlight = false
        }
      })()
    }, SYNC_DEBOUNCE_MS)

    return () => window.clearTimeout(timer)
  }, [userId, project.id, project.name])
}
