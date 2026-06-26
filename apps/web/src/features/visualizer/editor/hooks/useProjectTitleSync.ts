import { useCallback, useEffect, useRef } from 'react'
import { useCreateProject, useCurrentUser, useUpdateProject } from '@avl/sdk'
import type { Project } from '../../project/types'
import { createDefaultProject } from '../../project/defaultProject'

const MAP_KEY = 'avl.cloud-project-map.v1'
const SYNCED_KEY = 'avl.cloud-title-synced.v1'

type CloudProjectMap = Record<string, string>
type SyncedTitles = Record<string, string>

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

async function syncCloudProjectTitle(
  project: Project,
  userId: string,
  createProjectAsync: ReturnType<typeof useCreateProject>['mutateAsync'],
  updateProjectAsync: ReturnType<typeof useUpdateProject>['mutateAsync'],
) {
  const key = syncStorageKey(userId, project.id)
  if (readSyncedTitles()[key] === project.name || syncInFlight) return

  syncInFlight = true
  try {
    const map = readMap()
    const cloudId = map[project.id]
    if (cloudId) {
      await updateProjectAsync({ id: cloudId, title: project.name })
    } else {
      const saved = await createProjectAsync({
        title: project.name,
        documentJson: titleOnlyStub(project),
        schemaVersion: project.schemaVersion,
      })
      writeMap({ ...map, [project.id]: saved.id })
    }
    writeSyncedTitle(key, project.name)
  } catch {
    // Silent — local editing does not depend on cloud sync.
  } finally {
    syncInFlight = false
  }
}

/** Returns a function to sync project titles to cloud — call only on explicit rename. */
export function useCloudProjectTitleSync() {
  const { data: meData } = useCurrentUser()
  const userId = meData?.data?.id
  const createProject = useCreateProject()
  const updateProject = useUpdateProject()

  const createProjectAsyncRef = useRef(createProject.mutateAsync)
  createProjectAsyncRef.current = createProject.mutateAsync
  const updateProjectAsyncRef = useRef(updateProject.mutateAsync)
  updateProjectAsyncRef.current = updateProject.mutateAsync

  const prevUserIdRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
      writeMap({})
    }
    prevUserIdRef.current = userId
  }, [userId])

  return useCallback((project: Project) => {
    if (!userId) return Promise.resolve()
    return syncCloudProjectTitle(
      project,
      userId,
      createProjectAsyncRef.current,
      updateProjectAsyncRef.current,
    )
  }, [userId])
}
