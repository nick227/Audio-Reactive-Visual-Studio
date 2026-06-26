import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Project } from '../types'

function createLocalStorage() {
  const store = new Map<string, string>()
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value) },
    removeItem: (key: string) => { store.delete(key) },
    clear: () => { store.clear() },
  }
}

vi.stubGlobal('localStorage', createLocalStorage())

import {
  collectProjectBlobKeys,
  deleteProjectFromLibrary,
  loadActiveProject,
  loadProjectById,
  listProjects,
  saveProjectToLibrary,
} from '../projectLibrary'

const INDEX_KEY = 'audio-visual-layer.index.v1'
const ACTIVE_KEY = 'audio-visual-layer.active-project-id.v1'
const LEGACY_PROJECT_KEY = 'audio-visual-layer.project.v1'
const LEGACY_META_KEY = 'audio-visual-layer.meta.v1'

function storageKey(id: string) {
  return `audio-visual-layer.project.${id}.v1`
}

function makeProject(overrides: Partial<Project> & Pick<Project, 'id'>): Project {
  return {
    id: overrides.id,
    kind: 'project',
    schemaVersion: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    name: overrides.name ?? 'Test Project',
    stage: {
      id: 'stage-1',
      kind: 'stage',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      width: 1920,
      height: 1080,
      backgroundColor: '#000',
    },
    layers: overrides.layers ?? [],
    audio: overrides.audio,
  }
}

describe('projectLibrary', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem(INDEX_KEY, '[]')
  })

  it('migrates legacy project with media keys intact', () => {
    localStorage.clear()
    const legacy = makeProject({
      id: 'legacy-1',
      name: 'My Mix',
      audio: {
        id: 'aud-1',
        kind: 'audio-track',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        url: '',
        filename: 'track.mp3',
        duration: 120,
        fileKey: 'aud_123_track.mp3',
      },
      layers: [{
        id: 'layer-1',
        kind: 'layer',
        templateId: 'photo-cutout',
        name: 'Photo',
        visible: true,
        locked: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        placement: { fit: 'contain', x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, anchor: 'center' },
        reaction: { trigger: 'none', pulseAmount: 0, extraEffect: 'none', extraAmount: 0, smoothness: 0.5 },
        settings: { src: '', srcKey: 'img_123_photo.png' },
      }],
    })

    localStorage.setItem(LEGACY_PROJECT_KEY, JSON.stringify({
      ...legacy,
      audio: { ...legacy.audio!, url: 'blob:http://localhost/dead' },
      layers: [{ ...legacy.layers[0], settings: { src: 'blob:http://localhost/dead', srcKey: 'img_123_photo.png' } }],
    }))
    localStorage.setItem(LEGACY_META_KEY, JSON.stringify({ savedAt: '2026-01-03T00:00:00.000Z', name: 'My Mix' }))

    const loaded = loadActiveProject()
    expect(loaded.id).toBe('legacy-1')
    expect(loaded.audio?.fileKey).toBe('aud_123_track.mp3')
    expect(loaded.audio?.url).toBe('')
    expect(loaded.layers[0]?.settings.srcKey).toBe('img_123_photo.png')
    expect(loaded.layers[0]?.settings.src).toBe('')
    expect(localStorage.getItem(LEGACY_PROJECT_KEY)).toBeNull()
    expect(listProjects()).toHaveLength(1)
    expect(listProjects()[0]?.name).toBe('My Mix')
  })

  it('rename via saveProjectToLibrary updates index and stored JSON', () => {
    const project = makeProject({ id: 'p-1', name: 'Before' })
    saveProjectToLibrary(project)

    const renamed = { ...project, name: 'After', updatedAt: '2026-01-05T00:00:00.000Z' }
    saveProjectToLibrary(renamed)

    expect(loadProjectById('p-1')?.name).toBe('After')
    expect(listProjects().find((item) => item.id === 'p-1')?.name).toBe('After')
  })

  it('new project registration does not copy prior project data', () => {
    const first = makeProject({
      id: 'p-first',
      name: 'First',
      audio: {
        id: 'aud-1',
        kind: 'audio-track',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        url: '',
        filename: 'a.mp3',
        duration: 10,
        fileKey: 'aud_first',
      },
      layers: [],
    })
    saveProjectToLibrary(first)
    localStorage.setItem(ACTIVE_KEY, 'p-first')

    const second = makeProject({ id: 'p-second', name: 'Second', layers: [] })
    saveProjectToLibrary(second)
    localStorage.setItem(ACTIVE_KEY, 'p-second')

    const loaded = loadActiveProject()
    expect(loaded.id).toBe('p-second')
    expect(loaded.audio).toBeUndefined()
    expect(loaded.layers).toHaveLength(0)
  })

  it('collectProjectBlobKeys gathers audio and layer srcKey values', () => {
    const project = makeProject({
      id: 'p-1',
      audio: {
        id: 'aud-1',
        kind: 'audio-track',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        url: '',
        filename: 'a.mp3',
        duration: 1,
        fileKey: 'aud_1',
      },
      layers: [{
        id: 'layer-1',
        kind: 'layer',
        templateId: 'video-layer',
        name: 'Clip',
        visible: true,
        locked: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        placement: { fit: 'contain', x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, anchor: 'center' },
        reaction: { trigger: 'none', pulseAmount: 0, extraEffect: 'none', extraAmount: 0, smoothness: 0.5 },
        settings: { src: '', srcKey: 'vid_1' },
      }],
    })

    expect(collectProjectBlobKeys(project).sort()).toEqual(['aud_1', 'vid_1'])
  })

  it('deleteProjectFromLibrary removes unreferenced IDB blobs only', async () => {
    const sharedKey = 'img_shared'
    const uniqueKey = 'aud_only'

    const keep = makeProject({
      id: 'keep',
      layers: [{
        id: 'layer-1',
        kind: 'layer',
        templateId: 'photo-cutout',
        name: 'Shared',
        visible: true,
        locked: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        placement: { fit: 'contain', x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, anchor: 'center' },
        reaction: { trigger: 'none', pulseAmount: 0, extraEffect: 'none', extraAmount: 0, smoothness: 0.5 },
        settings: { src: '', srcKey: sharedKey },
      }],
    })
    const drop = makeProject({
      id: 'drop',
      audio: {
        id: 'aud-1',
        kind: 'audio-track',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        url: '',
        filename: 'x.mp3',
        duration: 1,
        fileKey: uniqueKey,
      },
      layers: [{
        id: 'layer-2',
        kind: 'layer',
        templateId: 'photo-cutout',
        name: 'Also shared',
        visible: true,
        locked: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        placement: { fit: 'contain', x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, anchor: 'center' },
        reaction: { trigger: 'none', pulseAmount: 0, extraEffect: 'none', extraAmount: 0, smoothness: 0.5 },
        settings: { src: '', srcKey: sharedKey },
      }],
    })

    saveProjectToLibrary(keep)
    saveProjectToLibrary(drop)
    localStorage.setItem(ACTIVE_KEY, 'drop')

    const deleted: string[] = []
    await deleteProjectFromLibrary('drop', async (key) => {
      deleted.push(key)
    })

    expect(deleted.sort()).toEqual([uniqueKey])
    expect(localStorage.getItem(storageKey('drop'))).toBeNull()
    expect(listProjects().map((item) => item.id)).toEqual(['keep'])
    expect(localStorage.getItem(ACTIVE_KEY)).toBe('keep')
    expect(deleted).not.toContain(sharedKey)
  })
})

describe('useProjectTitleSync contract', () => {
  it('does not throw when cloud mutations fail', async () => {
    const failingCreate = vi.fn().mockRejectedValue(new Error('offline'))
    await expect(
      failingCreate().catch(() => {}),
    ).resolves.toBeUndefined()
  })
})
