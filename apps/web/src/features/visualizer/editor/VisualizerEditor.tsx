import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { toast } from 'sonner'
import { Captions, Download, Loader2, Maximize2, Minimize2, Pause, Play, Plus, Upload, X } from 'lucide-react'
import html2canvas from 'html2canvas'
import { useCurrentUser, useCreateProject, useUpdateProject } from '@avl/sdk'
import { AudioEngine } from '../audio/AudioEngine'
import { buildWaveformPeaks } from '../audio/waveform'
import type { AudioFeatures } from '../audio/audioTypes'
import { silentAudioFeatures } from '../audio/audioTypes'
import { createDefaultProject } from '../project/defaultProject'
import { clearSavedProject } from '../project/projectPersistence'
import type { LayerInstance, Project, StagePresetId } from '../project/types'
import { assetRegistry } from '../assets/registry'
import { createEntityId, nowIso } from '../entities/entityTypes'
import { isTypographyLayer } from '../runtime/layerVisualKind'
import { Stage, type StageHandle } from './Stage'
import { Waveform } from './Waveform'
import { AssetList } from './AssetList'
import { MediaModal } from './MediaModal'
import { SubtitleModal } from './SubtitleModal'
import { ExportPanel } from './ExportPanel'
import { exportFileBase, suggestExportTitle } from '../export/exportTitle'
import { WEBCODECS_SUPPORTED, AUDIO_ENCODER_SUPPORTED, exportVideoWebCodecs, type FrameStats, type WebCodecsExportPhase } from '../export/webcodecs'
import { computeOutputSize, DEFAULT_PRESET_ID, getPreset, type ExportPreset, type PresetId } from '../export/presets'
import { prepareExport, ExportValidationError } from '../export/prepare'
import type { ExportRenderContext } from '../export/prepare'
import {
  canUseNativeRenderer,
  analyzeRendererSupport,
  createExportVideoElements,
  disposeExportVideoElements,
  renderCanvasFrame,
} from '../export/renderCanvasFrame'
import { VideoSettingsModal } from './VideoSettingsModal'
import { idbPut, idbGet, idbDelete } from '../storage/idbStorage'
import { SiteTopBar } from '../../../components/SiteTopBar'
import {
  FrameChunkCache,
  buildChunkFingerprintMap,
  buildPrerenderChunks,
  chunkFrameRange,
  chunkIndexAtTime,
  detectDirtyChunkIndexes,
  frameTimeMs,
  prioritizeDirtyChunks,
  scheduleIdleTask,
  type CachedChunkStats,
  type RenderChunkIdentity,
} from '../prerender'
import { applyLayerPatch } from './core/layerPatch'
import { getActiveStagePresetId, stagePresets } from './core/stagePresets'
import { clearLastExportMeta, loadLastExportMeta, saveLastExportMeta, type LastExportMeta } from './core/exportMeta'
import { useEditorModal } from './hooks/useEditorModal'
import { useEditorHistory } from './hooks/useEditorHistory'
import { useEditorPersistence } from './hooks/useEditorPersistence'
import { useManagedObjectUrls } from './hooks/useManagedObjectUrls'
import { useMediaLibrary } from './hooks/useMediaLibrary'

const UI_FRAME_INTERVAL_MS = 100

function cloneProject(p: Project): Project {
  return structuredClone(p)
}

function waitForPrerenderIdle(signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(new DOMException('Prerender cancelled', 'AbortError'))
  return new Promise<void>((resolve, reject) => {
    let cancelIdle: (() => void) | null = null
    const onAbort = () => {
      cancelIdle?.()
      reject(new DOMException('Prerender cancelled', 'AbortError'))
    }
    signal.addEventListener('abort', onAbort, { once: true })
    cancelIdle = scheduleIdleTask(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    })
  })
}

export function VisualizerEditor() {
  const { present: project, patchPresent, commitProject, undo, redo, resetHistory } = useEditorHistory()

  // ── Cloud save ───────────────────────────────────────────────────────────
  const { data: meData } = useCurrentUser()
  const me = meData?.data ?? null
  const createProject = useCreateProject()
  const updateProject = useUpdateProject()
  const [cloudProjectId, setCloudProjectId] = useState<string | null>(() =>
    localStorage.getItem('avl.cloud-project-id')
  )
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<string | null>(null)

  // Refs for auto-cloud-save and beforeunload — avoids stale closures in intervals/event handlers
  const cloudDirtyRef = useRef(false)
  const { localSavedAt } = useEditorPersistence({ project, cloudDirtyRef })
  const lastAutoCloudSaveRef = useRef(cloudProjectId ? Date.now() : 0)
  const projectRef = useRef(project)
  projectRef.current = project

  // Clear stale cloud project ID when the user changes (logout or different user on same browser)
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
      const doc = JSON.parse(JSON.stringify(projectRef.current)) // deep clone, strips undefined
      if (cloudProjectId) {
        await updateProject.mutateAsync({ id: cloudProjectId, title: projectRef.current.name, documentJson: doc })
      } else {
        const saved = await createProject.mutateAsync({ title: projectRef.current.name, documentJson: doc, schemaVersion: projectRef.current.schemaVersion })
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
  // ────────────────────────────────────────────────────────────────────────

  const [selectedLayerId, setSelectedLayerId] = useState(() => project.layers[project.layers.length - 1]?.id ?? '')
  const [isPlaying, setIsPlaying] = useState(false)
  const [meterFeatures, setMeterFeatures] = useState<AudioFeatures>(silentAudioFeatures)
  const [peaks, setPeaks] = useState<number[]>(new Array(160).fill(0.12))
  const [progress, setProgress] = useState(0)
  const { modal, closeModal, openMediaModal, openSubtitleModal: showSubtitleModal, openVideoSettingsModal, openExportModal } = useEditorModal()
  const [isExporting, setIsExporting] = useState(false)
  const [isPreparing, setIsPreparing] = useState(false)
  const [preparePhase, setPreparePhase] = useState('')
  const [prepareProgress, setPrepareProgress] = useState(0)
  const [isExportingVideo, setIsExportingVideo] = useState(false)
  const [exportVideoProgress, setExportVideoProgress] = useState(0)
  const [exportPhase, setExportPhase] = useState<WebCodecsExportPhase | ''>('')
  const [exportSnapshot, setExportSnapshot] = useState<Project | null>(null)
  const [lastExport, setLastExport] = useState<LastExportMeta | null>(() => loadLastExportMeta())
  const stageProject = exportSnapshot ?? project
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [fsUiIdle, setFsUiIdle] = useState(false)
  const fsIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [currentTimeMs, setCurrentTimeMs] = useState(0)
  const playbackTimeMsRef = useRef(0)
  const exportActiveRef = useRef(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const engineRef = useRef<AudioEngine | null>(null)
  const rafRef = useRef<number | null>(null)
  const stageRef = useRef<StageHandle | null>(null)
  const lastUiFrameRef = useRef(0)
  const { activeAudioObjectUrlRef, registerObjectUrl, revokeManagedObjectUrl, revokeAllObjectUrls } = useManagedObjectUrls()
  const tickRef = useRef<(time: number) => void>(() => {})
  const exportCancelRef = useRef(false)
  const exportAbortRef = useRef<AbortController | null>(null)

  // Per-frame encode stats: updated during video export for ETA display.
  const [exportStats, setExportStats] = useState<FrameStats | null>(null)
  const [preferredExportPresetId, setPreferredExportPresetId] = useState<PresetId>(() => {
    const stored = localStorage.getItem('avl-export-preset-id')
    return (stored === 'draft' || stored === 'standard' || stored === 'high' || stored === 'smooth')
      ? stored
      : DEFAULT_PRESET_ID
  })
  const [prerenderStats, setPrerenderStats] = useState<CachedChunkStats>({
    preparedChunks: 0,
    totalChunks: 0,
    cachedFrames: 0,
  })
  const prerenderCacheRef = useRef(new FrameChunkCache(8, 360))
  const prerenderFingerprintsRef = useRef<Map<number, RenderChunkIdentity> | null>(null)
  const prerenderRevisionRef = useRef(0)

  // Renderer diagnostics: computed from current project layers (both for ExportPanel display
  // and to derive rendererMode without a redundant second pass).
  const rendererDiagnostics = useMemo(
    () => analyzeRendererSupport(project.layers),
    [project.layers],
  )
  const rendererMode = rendererDiagnostics.mode
  const hasAudio = Boolean(project.audio?.url)
  const mediaLibrary = useMediaLibrary({
    project,
    patchPresent,
    commitProject,
    audioRef,
    activeAudioObjectUrlRef,
    registerObjectUrl,
    setSelectedLayerId,
    setPeaks,
    closeModal,
  })

  const updatePrerenderStats = useCallback((totalChunks: number, identities?: Iterable<RenderChunkIdentity>) => {
    setPrerenderStats(prerenderCacheRef.current.stats(totalChunks, identities))
  }, [])

  useEffect(() => {
    const durationMs = (project.audio?.duration ?? 0) * 1000
    if (!hasAudio || durationMs <= 0 || rendererDiagnostics.mode !== 'native' || isPreparing || isExportingVideo) {
      prerenderFingerprintsRef.current = null
      updatePrerenderStats(0)
      return
    }

    if (typeof createImageBitmap === 'undefined') {
      updatePrerenderStats(0)
      return
    }

    const stageEl = stageRef.current?.getStageElement()
    if (!stageEl) return

    const revision = ++prerenderRevisionRef.current
    const abort = new AbortController()
    const debounce = window.setTimeout(() => {
      void (async () => {
        const snapshot = cloneProject(project)
        const preset = getPreset(preferredExportPresetId)
        const displayW = stageEl.offsetWidth
        const displayH = stageEl.offsetHeight
        const { w: outputW, h: outputH } = computeOutputSize(displayW, displayH, preset)
        const chunks = buildPrerenderChunks(durationMs)
        const identities = buildChunkFingerprintMap(snapshot, chunks, preset, outputW, outputH)
        const dirty = detectDirtyChunkIndexes(prerenderFingerprintsRef.current, identities)
        const validKeys = new Set(Array.from(identities.values(), (identity) => identity.key))
        prerenderCacheRef.current.invalidateMissing(validKeys)

        for (const [index, identity] of identities) {
          if (!prerenderCacheRef.current.isChunkPrepared(identity)) dirty.add(index)
        }

        prerenderFingerprintsRef.current = identities
        updatePrerenderStats(chunks.length, identities.values())

        if (dirty.size === 0) return

        const outputCanvas = document.createElement('canvas')
        outputCanvas.width = outputW
        outputCanvas.height = outputH
        const ctx = outputCanvas.getContext('2d')
        if (!ctx) return

        const videoEls = createExportVideoElements(snapshot.layers)
        let manifest: Awaited<ReturnType<typeof prepareExport>> | null = null
        try {
          manifest = await prepareExport({
            snapshot,
            preset,
            outputWidth: outputW,
            outputHeight: outputH,
            sourceDisplayWidth: displayW,
            sourceDisplayHeight: displayH,
            signal: abort.signal,
            rehearseCompat: async () => {},
            rehearseNative: async (timeMs: number, renderCtx: ExportRenderContext) => {
              await renderCanvasFrame(ctx, snapshot, renderCtx, videoEls, timeMs)
            },
            onProgress: () => {},
          })

          if (!manifest.nativeRenderer || abort.signal.aborted || revision !== prerenderRevisionRef.current) return

          const queue = prioritizeDirtyChunks(chunks, dirty, playbackTimeMsRef.current, durationMs).slice(0, 8)
          for (const item of queue) {
            if (abort.signal.aborted || revision !== prerenderRevisionRef.current) return
            const identity = identities.get(item.chunk.index)
            if (!identity || prerenderCacheRef.current.isChunkPrepared(identity)) continue

            await waitForPrerenderIdle(abort.signal)
            const { startFrame, endFrame } = chunkFrameRange(item.chunk, preset.fps, durationMs)
            const totalFrames = Math.max(0, endFrame - startFrame)

            for (let frameIndex = startFrame; frameIndex < endFrame; frameIndex++) {
              if (abort.signal.aborted || revision !== prerenderRevisionRef.current) return
              await renderCanvasFrame(ctx, snapshot, manifest, videoEls, frameTimeMs(frameIndex, preset.fps))
              const frame = await createImageBitmap(outputCanvas)
              prerenderCacheRef.current.putFrame(identity, item.chunk, frameIndex, totalFrames, frame)

              if (frameIndex % 8 === 7) {
                await new Promise<void>((resolve) => window.setTimeout(resolve, 0))
              }
            }

            updatePrerenderStats(chunks.length, identities.values())
          }
        } catch (e) {
          if (!(e instanceof DOMException && e.name === 'AbortError')) {
            console.warn('[AVL Prerender] background prerender skipped', e)
          }
        } finally {
          if (manifest) {
            for (const layer of manifest.layers) layer.bitmap?.close()
          }
          disposeExportVideoElements(videoEls)
          updatePrerenderStats(chunks.length, identities.values())
        }
      })()
    }, 800)

    return () => {
      window.clearTimeout(debounce)
      abort.abort()
    }
  }, [
    hasAudio,
    isExportingVideo,
    isPreparing,
    preferredExportPresetId,
    project,
    rendererDiagnostics.mode,
    updatePrerenderStats,
  ])

  const syncStageFrame = useCallback((timeMs: number) => {
    playbackTimeMsRef.current = timeMs
    const engine = engineRef.current
    const features = engine?.getFeatures() ?? silentAudioFeatures
    stageRef.current?.updateFrame(features, performance.now(), timeMs)
  }, [])

  const activeStagePreset = useMemo(
    () => getActiveStagePresetId(project.stage.width, project.stage.height),
    [project.stage.height, project.stage.width],
  )
  const suggestedExportTitle = useMemo(
    () => suggestExportTitle(project.audio?.filename, project.name),
    [project.audio?.filename, project.name],
  )

  // If the selected layer was removed by undo/redo, fall back to the topmost layer.
  useEffect(() => {
    if (selectedLayerId && !project.layers.find((l) => l.id === selectedLayerId)) {
      setSelectedLayerId(project.layers[project.layers.length - 1]?.id ?? '')
    }
  }, [project.layers, selectedLayerId])

  // Clicking outside the stage canvas deselects all layers.
  // Layer pointerdowns call stopPropagation so they never reach this handler.
  useEffect(() => {
    const handler = (e: PointerEvent) => {
      const stageEl = stageRef.current?.getStageElement()
      if (stageEl && !stageEl.contains(e.target as Node)) {
        setSelectedLayerId('')
      }
    }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [])

  const persistExportTitle = useCallback((title: string) => {
    const name = title.trim() || suggestedExportTitle
    if (name === project.name) return
    commitProject((p) => ({ ...p, name }))
  }, [commitProject, project.name, suggestedExportTitle])

  const togglePlaybackRef = useRef<() => void>(() => {})

  // ── Text editing ─────────────────────────────────────────────────────────────

  const [textEditLayerId, setTextEditLayerId] = useState<string | null>(null)
  const textEditLayerIdRef = useRef<string | null>(null)
  textEditLayerIdRef.current = textEditLayerId

  const handleLayerDoubleClick = useCallback((layerId: string) => {
    const layer = project.layers.find((l) => l.id === layerId)
    if (layer && isTypographyLayer(layer)) setTextEditLayerId(layerId)
  }, [project.layers])

  const handleTextChange = useCallback((layerId: string, text: string) => {
    patchPresent((p) => ({ ...p, layers: applyLayerPatch(p.layers, layerId, { settings: { text } }) }))
  }, [patchPresent])

  const handleTextCommit = useCallback((layerId: string, text: string) => {
    if (textEditLayerIdRef.current !== layerId) return
    commitProject((p) => ({ ...p, layers: applyLayerPatch(p.layers, layerId, { settings: { text } }) }))
    setTextEditLayerId(null)
  }, [commitProject])

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return
      if (e.key === ' ') { e.preventDefault(); togglePlaybackRef.current(); return }
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      if ((e.key === 'z' && e.shiftKey) || e.key === 'y') { e.preventDefault(); redo() }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [undo, redo])

  // ── Full-screen idle ─────────────────────────────────────────────────────────

  const resetFsIdleTimer = useCallback(() => {
    setFsUiIdle(false)
    if (fsIdleTimerRef.current) clearTimeout(fsIdleTimerRef.current)
    fsIdleTimerRef.current = setTimeout(() => setFsUiIdle(true), 2500)
  }, [])

  useEffect(() => {
    if (isFullScreen) {
      resetFsIdleTimer()
      return () => { if (fsIdleTimerRef.current) clearTimeout(fsIdleTimerRef.current) }
    } else {
      if (fsIdleTimerRef.current) clearTimeout(fsIdleTimerRef.current)
      setFsUiIdle(false)
    }
  }, [isFullScreen, resetFsIdleTimer])

  useEffect(() => {
    if (!isFullScreen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsFullScreen(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isFullScreen])

  useEffect(() => {
    const audio = audioRef.current
    const prerenderCache = prerenderCacheRef.current
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      audio?.pause()
      prerenderCache.clear()
    }
  }, [])

  // Auto-save to cloud every 5 minutes for signed-in users.
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

  // ── Layer operations ─────────────────────────────────────────────────────────

  // Committed update — for inspector/assetlist controls. Pushes to undo history.
  const updateLayer = useCallback((layerId: string, patch: Partial<LayerInstance>) => {
    commitProject((current) => ({ ...current, layers: applyLayerPatch(current.layers, layerId, patch) }))
  }, [commitProject])

  // Transient update — for stage drag. Only updates present, no history push.
  const updateLayerTransient = useCallback((layerId: string, patch: Partial<LayerInstance>) => {
    patchPresent((current) => ({ ...current, layers: applyLayerPatch(current.layers, layerId, patch) }))
  }, [patchPresent])

  // Snapshots present into past before a drag starts, so the full drag is one undo step.
  const snapshotForDrag = useCallback(() => {
    commitProject((current) => current)
  }, [commitProject])

  const addTemplate = useCallback((templateId: string) => {
    const template = assetRegistry.get(templateId)
    if (!template) return
    const layer = template.createLayer()
    commitProject((current) => ({ ...current, layers: [...current.layers, layer] }))
    setSelectedLayerId(layer.id)
    closeModal()
  }, [closeModal, commitProject])

  const openSubtitleEditor = useCallback((layerId?: string) => {
    if (layerId) {
      setSelectedLayerId(layerId)
      showSubtitleModal(layerId)
    } else {
      const template = assetRegistry.get('subtitle-layer')
      if (!template) return
      const layer = template.createLayer()
      commitProject((current) => ({ ...current, layers: [...current.layers, layer] }))
      setSelectedLayerId(layer.id)
      showSubtitleModal(layer.id)
    }
  }, [commitProject, showSubtitleModal])

  const editSubtitleLayer = useCallback((layerId: string) => {
    openSubtitleEditor(layerId)
  }, [openSubtitleEditor])

  const updateSubtitleLayerCues = useCallback((layerId: string, cues: import('../subtitles/parseSrt').SrtCue[]) => {
    commitProject((current) => ({ ...current, layers: applyLayerPatch(current.layers, layerId, { settings: { cues } }) }))
  }, [commitProject])


  // Does NOT revoke blob URLs or delete IDB entries — undo may restore the layer.
  // Cleanup happens on resetProject or session end.
  const removeLayer = useCallback((layerId: string) => {
    commitProject((current) => ({ ...current, layers: current.layers.filter((l) => l.id !== layerId) }))
    if (selectedLayerId === layerId) setSelectedLayerId('')
  }, [commitProject, selectedLayerId])

  const reorderLayers = useCallback((layers: LayerInstance[]) => {
    commitProject((current) => ({ ...current, layers }))
  }, [commitProject])

  // ── Project-level operations ─────────────────────────────────────────────────

  const stopPlayback = useCallback(() => {
    audioRef.current?.pause()
    setIsPlaying(false)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
  }, [])

  const resetProject = useCallback(() => {
    if (!window.confirm('Start a new project? All layers and unsaved changes will be cleared.')) return
    stopPlayback()
    // Cleanup IDB entries for uploaded files in the current project
    for (const layer of project.layers) {
      if (typeof layer.settings.srcKey === 'string') void idbDelete(String(layer.settings.srcKey))
    }
    if (project.audio?.fileKey) void idbDelete(project.audio.fileKey)
    clearSavedProject()
    revokeAllObjectUrls()
    if (audioRef.current) audioRef.current.src = ''
    const fresh = createDefaultProject()
    resetHistory(fresh)
    setSelectedLayerId(fresh.layers[fresh.layers.length - 1]?.id ?? '')
    setPeaks(new Array(160).fill(0.12))
    setProgress(0)
    setIsPlaying(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.audio?.fileKey, project.layers])

  const exportPng = useCallback(async (title: string) => {
    const stageEl = stageRef.current?.getStageElement()
    const audio = audioRef.current
    if (!stageEl) return
    persistExportTitle(title)
    setIsExporting(true)
    try {
      const ms = (audio?.currentTime ?? 0) * 1000
      syncStageFrame(ms)
      const scale = project.stage.width / stageEl.offsetWidth
      const canvas = await html2canvas(stageEl, { scale, useCORS: true, allowTaint: true, logging: false })
      const url = canvas.toDataURL('image/png')
      const a = document.createElement('a')
      a.href = url
      a.download = `${exportFileBase(title.trim() || suggestedExportTitle)}.png`
      a.click()
    } finally {
      setIsExporting(false)
    }
  }, [persistExportTitle, project.stage.width, suggestedExportTitle, syncStageFrame])

  // ── Audio ────────────────────────────────────────────────────────────────────

  const handleAudioFile = async (file: File) => {
    const audio = audioRef.current
    if (!audio) return
    stopPlayback()

    if (activeAudioObjectUrlRef.current) revokeManagedObjectUrl(activeAudioObjectUrlRef.current)
    if (project.audio?.fileKey) void idbDelete(project.audio.fileKey)

    const url = registerObjectUrl(URL.createObjectURL(file))
    activeAudioObjectUrlRef.current = url

    const fileKey = `aud_${Date.now()}_${file.name}`
    try { await idbPut(fileKey, file) } catch { /* IDB unavailable */ }

    const audioEntity = {
      id: createEntityId('audio'),
      kind: 'audio-track' as const,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      url,
      filename: file.name,
      duration: 0,
      fileKey,
    }

    commitProject((current) => ({ ...current, audio: audioEntity }))
    setProgress(0)

    audio.onloadedmetadata = () => {
      // Duration is auto-detected, not a user action — patch present without pushing to history.
      patchPresent((current) => ({
        ...current,
        audio: current.audio ? { ...current.audio, duration: audio.duration || 0, updatedAt: nowIso() } : audioEntity,
      }))
    }
    audio.src = url
    audio.load()

    const nextPeaks = await buildWaveformPeaks(file)
    setPeaks(nextPeaks)
  }

  const tick = (time: number) => {
    const audio = audioRef.current
    const engine = engineRef.current
    if (!audio || !engine) return

    const features = engine.getFeatures()
    const playbackMs = audio.currentTime * 1000
    playbackTimeMsRef.current = playbackMs
    stageRef.current?.updateFrame(features, time, playbackMs)

    if (!exportActiveRef.current && time - lastUiFrameRef.current >= UI_FRAME_INTERVAL_MS) {
      lastUiFrameRef.current = time
      setMeterFeatures(features)
      setProgress(audio.duration ? audio.currentTime / audio.duration : 0)
      setCurrentTimeMs(playbackMs)
    }

    if (!audio.paused) rafRef.current = requestAnimationFrame(tickRef.current)
  }
  tickRef.current = tick

  const togglePlayback = useCallback(async () => {
    const audio = audioRef.current
    if (!audio || !audio.src) return
    engineRef.current ??= new AudioEngine()
    engineRef.current.connect(audio)
    await engineRef.current.resume()
    if (audio.paused) {
      await audio.play()
      setIsPlaying(true)
      rafRef.current = requestAnimationFrame(tickRef.current)
    } else {
      stopPlayback()
    }
  }, [stopPlayback])
  togglePlaybackRef.current = () => { void togglePlayback() }

  const seek = (ratio: number) => {
    const audio = audioRef.current
    if (!audio || !audio.duration) return
    audio.currentTime = ratio * audio.duration
    const ms = audio.currentTime * 1000
    setProgress(ratio)
    setCurrentTimeMs(ms)
    syncStageFrame(ms)
  }

  const exportWebm = useCallback(async (snapshot: Project, preset: ExportPreset) => {
    const audio = audioRef.current
    const stageEl = stageRef.current?.getStageElement()
    if (!audio || !stageEl || !snapshot.audio?.duration) return
    const duration = snapshot.audio.duration

    flushSync(() => {
      setExportSnapshot(snapshot)
      openExportModal()
    })

    const displayW = stageEl.offsetWidth
    const displayH = stageEl.offsetHeight
    const { w: outputW, h: outputH } = computeOutputSize(displayW, displayH, preset)
    const outputCanvas = document.createElement('canvas')
    outputCanvas.width = outputW
    outputCanvas.height = outputH
    const ctx = outputCanvas.getContext('2d')!

    exportCancelRef.current = false
    exportActiveRef.current = true

    // html2canvas render — used when compat mode is chosen by the manifest.
    const renderCompat = async (timeMs: number) => {
      setCurrentTimeMs(timeMs)
      syncStageFrame(timeMs)
      try {
        const frame = await html2canvas(stageEl, { scale: 1, useCORS: true, allowTaint: true, logging: false })
        ctx.drawImage(frame, 0, 0, outputW, outputH)
      } catch { /* non-fatal: skip frame */ }
    }

    // Pre-create video elements so they begin loading during the preparation phase.
    // We create them speculatively (same logic as rendererDiagnostics) — if the
    // manifest ends up in compat mode they're simply never used (disposed in cleanup).
    const videoEls = canUseNativeRenderer(snapshot.layers)
      ? createExportVideoElements(snapshot.layers)
      : new Map<string, HTMLVideoElement>()

    // ── Preparation phase ─────────────────────────────────────────────────────
    const abort = new AbortController()
    exportAbortRef.current = abort

    setIsPreparing(true)
    setPrepareProgress(0)
    setPreparePhase('')

    let manifest: Awaited<ReturnType<typeof prepareExport>> | null = null
    try {
      manifest = await prepareExport({
        snapshot,
        preset,
        outputWidth: outputW,
        outputHeight: outputH,
        sourceDisplayWidth: displayW,
        sourceDisplayHeight: displayH,
        signal: abort.signal,
        rehearseCompat: renderCompat,
        rehearseNative: async (timeMs: number, renderCtx: ExportRenderContext) => {
          await renderCanvasFrame(ctx, snapshot, renderCtx, videoEls, timeMs)
        },
        onProgress: ({ phaseLabel, overall }) => {
          setPreparePhase(phaseLabel)
          setPrepareProgress(overall)
        },
      })
    } catch (e) {
      if (e instanceof ExportValidationError) {
        toast.error(e.message)
      } else if (!(e instanceof DOMException && e.name === 'AbortError')) {
        toast.error('Export preparation failed.')
        console.error('[prepareExport]', e)
      }
      disposeExportVideoElements(videoEls)
      exportAbortRef.current = null
      exportActiveRef.current = false
      setIsPreparing(false)
      setExportSnapshot(null)
      return
    } finally {
      setIsPreparing(false)
    }

    if (abort.signal.aborted) {
      disposeExportVideoElements(videoEls)
      exportAbortRef.current = null
      exportActiveRef.current = false
      setExportSnapshot(null)
      return
    }

    if (manifest.rehearsalFramesOk === 0) {
      toast.error('Rehearsal failed — the stage could not be rendered. Export aborted.')
      disposeExportVideoElements(videoEls)
      exportAbortRef.current = null
      exportActiveRef.current = false
      setExportSnapshot(null)
      return
    }

    // ── Encode phase ──────────────────────────────────────────────────────────
    setIsExportingVideo(true)
    setExportVideoProgress(0)
    setExportPhase('encoding-frames')
    setExportStats(null)

    // Render function for the encode loop: native canvas or html2canvas compat.
    // Use manifest.nativeRenderer (authoritative) rather than the pre-compute local flag.
    const capturedManifest = manifest
    const exportChunks = buildPrerenderChunks(duration * 1000)
    const exportIdentities = buildChunkFingerprintMap(snapshot, exportChunks, preset, outputW, outputH)
    const renderFrame = capturedManifest.nativeRenderer
      ? async (timeMs: number) => {
          const frameIndex = Math.round((timeMs / 1000) * preset.fps)
          const chunkIndex = chunkIndexAtTime(timeMs, duration * 1000)
          const identity = exportIdentities.get(chunkIndex)
          const cachedFrame = identity ? prerenderCacheRef.current.getFrame(identity, frameIndex) : null
          if (cachedFrame) {
            ctx.clearRect(0, 0, outputW, outputH)
            ctx.drawImage(cachedFrame, 0, 0, outputW, outputH)
            return
          }
          await renderCanvasFrame(ctx, snapshot, capturedManifest, videoEls, timeMs)
        }
      : renderCompat

    // Cleanup: close bitmaps and video elements, reset state.
    const cleanup = () => {
      for (const layer of capturedManifest.layers) layer.bitmap?.close()
      disposeExportVideoElements(videoEls)
      exportAbortRef.current = null
      exportActiveRef.current = false
      setExportSnapshot(null)
      setIsExportingVideo(false)
      setExportVideoProgress(0)
      setExportPhase('')
      setExportStats(null)
    }

    if (WEBCODECS_SUPPORTED) {
      // ── WebCodecs path: deterministic timestamps, frame-accurate encode ──
      try {
        const { blob } = await exportVideoWebCodecs({
          canvas: outputCanvas,
          fps: preset.fps,
          durationMs: duration * 1000,
          bitrate: preset.bitrate,
          audioUrl: snapshot.audio?.url,
          onProgress: (p) => setExportVideoProgress(p),
          onFrameStats: setExportStats,
          onPhase: setExportPhase,
          signal: abort.signal,
          renderFrame,
          videoCodec: preset.videoCodec,
          maxVideoEncodeQueueSize: preset.maxVideoEncodeQueueSize,
        })

        if (!abort.signal.aborted) {
          console.time('[AVL Export] caller completion/download')
          try {
            setExportPhase('complete')
            const mimeType = 'video/webm'
            const filename = `${exportFileBase(snapshot.name)}.webm`
            try {
              await idbPut('export-webm-last', blob)
              const meta = { filename, mimeType }
              saveLastExportMeta(meta)
              setLastExport(meta)
            } catch { /* IDB unavailable — download still proceeds */ }
            if (abort.signal.aborted) throw new DOMException('Export cancelled', 'AbortError')
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = filename
            a.click()
            setTimeout(() => URL.revokeObjectURL(url), 30_000)
            console.log('[AVL Export] caller completion', { filename, mimeType, blobSize: blob.size })
          } finally {
            console.timeEnd('[AVL Export] caller completion/download')
          }
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') {
          // cancelled — no-op
        } else {
          const message = e instanceof Error ? e.message : 'Video export failed. Try the MediaRecorder fallback.'
          toast.error(message)
          console.error('[WebCodecs export]', e)
        }
      } finally {
        cleanup()
      }
    } else {
      // ── MediaRecorder fallback: real-time canvas capture with audio ──
      const mimeType = (
        ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'] as const
      ).find((t) => MediaRecorder.isTypeSupported(t)) ?? 'video/webm'

      audio.currentTime = 0
      engineRef.current ??= new AudioEngine()
      engineRef.current.connect(audio)
      await engineRef.current.resume()
      engineRef.current.setOutputMuted(true)

      const videoTracks = outputCanvas.captureStream(preset.fps).getTracks()
      const audioStream = engineRef.current.getAudioStream()
      const recordStream = audioStream
        ? new MediaStream([...videoTracks, ...audioStream.getTracks()])
        : new MediaStream(videoTracks)

      const recorder = new MediaRecorder(recordStream, { mimeType, videoBitsPerSecond: preset.bitrate })
      const chunks: Blob[] = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }

      try {
        recorder.start(250)
        await audio.play()
        setIsPlaying(true)
        rafRef.current = requestAnimationFrame(tickRef.current)

        while (!exportCancelRef.current && !audio.ended && audio.currentTime < duration) {
          try {
            const frameMs = audio.currentTime * 1000
            setCurrentTimeMs(frameMs)
            syncStageFrame(frameMs)
            const frame = await html2canvas(stageEl, { scale: 1, useCORS: true, allowTaint: true, logging: false })
            ctx.drawImage(frame, 0, 0, outputW, outputH)
          } catch { /* skip frame */ }
          setExportVideoProgress(Math.min(audio.currentTime / duration, 1))
          await new Promise<void>((r) => setTimeout(r, 0))
        }

        stopPlayback()
        await new Promise<void>((r) => {
          recorder.addEventListener('stop', () => r(), { once: true })
          recorder.stop()
        })

        if (!exportCancelRef.current && chunks.length > 0) {
          const blob = new Blob(chunks, { type: mimeType })
          const filename = `${exportFileBase(snapshot.name)}.webm`
          try {
            await idbPut('export-webm-last', blob)
            const meta = { filename, mimeType }
            saveLastExportMeta(meta)
            setLastExport(meta)
          } catch { /* IDB unavailable — download still proceeds */ }
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = filename
          a.click()
          setTimeout(() => URL.revokeObjectURL(url), 30_000)
        }
      } finally {
        engineRef.current?.setOutputMuted(false)
        cleanup()
      }
    }
  }, [openExportModal, stopPlayback, syncStageFrame])

  const beginExportWebm = useCallback((title: string, preset: ExportPreset) => {
    const name = title.trim() || suggestedExportTitle
    persistExportTitle(title)
    const snapshot = cloneProject(project)
    snapshot.name = name
    void exportWebm(snapshot, preset)
  }, [exportWebm, persistExportTitle, project, suggestedExportTitle])

  const downloadLastExport = useCallback(async () => {
    if (!lastExport) return
    try {
      const blob = await idbGet('export-webm-last')
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = lastExport.filename
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 30_000)
    } catch { /* IDB unavailable */ }
  }, [lastExport])

  const clearLastExport = useCallback(() => {
    void idbDelete('export-webm-last')
    clearLastExportMeta()
    setLastExport(null)
  }, [])

  // ── Stage preset ─────────────────────────────────────────────────────────────

  const setStagePreset = (presetId: StagePresetId) => {
    const preset = stagePresets.find((p) => p.id === presetId)
    if (!preset) return
    commitProject((current) => ({
      ...current,
      stage: { ...current.stage, width: preset.width, height: preset.height, preset: preset.id, updatedAt: nowIso() },
    }))
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div
      className={`app-shell${isFullScreen ? ' full-screen' : ''}${isFullScreen && fsUiIdle ? ' fs-ui-idle' : ''}`}
      onPointerMove={isFullScreen ? resetFsIdleTimer : undefined}
    >
      <audio ref={audioRef} onEnded={() => { setIsPlaying(false); setProgress(1) }} />

      {!isFullScreen && (
        <SiteTopBar
          onSaveToCloud={me ? handleSaveToCloud : undefined}
          isSaving={isSaving}
          lastCloudSaved={lastSaved}
          localSavedAt={localSavedAt}
        />
      )}

      <div className={`editor-body ${activeStagePreset}-screen${isFullScreen ? ' full-screen' : ''}`}>

        {/* ── Stage ── */}
        <div className="stage-area">
          <div className="stage-controls">
            <div className="preset-switcher">
              {stagePresets.map((p) => {
                const Icon = p.icon
                return (
                  <button key={p.id} className={activeStagePreset === p.id ? 'active' : ''} onClick={() => setStagePreset(p.id)} title={`${p.label} · ${p.width} × ${p.height}`}>
                    <Icon size={13} />
                  </button>
                )
              })}
            </div>
            <button className="fs-toggle-btn" onClick={() => setIsFullScreen((v) => !v)} title={isFullScreen ? 'Exit full screen (Esc)' : 'Full screen'}>
              {isFullScreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>
          </div>
          <div className="stage-viewport">
            <Stage
              ref={stageRef}
              project={stageProject}
              selectedLayerId={selectedLayerId}
              isPlaying={isPlaying}
              onSelectLayer={(id) => {
                setSelectedLayerId(id)
                if (id !== textEditLayerIdRef.current) setTextEditLayerId(null)
              }}
              onUpdateLayer={updateLayerTransient}
              onDragStart={snapshotForDrag}
              onDoubleClickLayer={handleLayerDoubleClick}
              editingLayerId={textEditLayerId}
              onTextChange={handleTextChange}
              onTextCommit={handleTextCommit}
              currentTimeMs={currentTimeMs}
            />
          </div>
        </div>

        {/* ── Transport ── */}
        <div className="transport">
          <button className="transport-play" onClick={() => void togglePlayback()} disabled={!hasAudio} aria-label={isPlaying ? 'Pause' : 'Play'}>
            {isPlaying ? <Pause size={15} /> : <Play size={15} />}
          </button>
          <div className="transport-waveform">
            <Waveform peaks={peaks} progress={progress} onSeek={seek} />
          </div>
          <label className="transport-audio-label" title={hasAudio ? project.audio?.filename : 'Upload audio'}>
            <Upload size={13} />
            <span>{hasAudio ? project.audio!.filename : 'Add Audio'}</span>
            <input type="file" accept="audio/*" hidden onChange={(e) => e.target.files?.[0] && void handleAudioFile(e.target.files[0])} />
          </label>
        </div>

        {/* ── Layers ── */}
        {!isFullScreen && (
          <>
            {/* ── Layer list header ── */}
            <div className="layers-header">
              <DownloadMediaButton
                hasAudio={hasAudio}
                isExportingVideo={isExportingVideo}
                progress={exportVideoProgress}
                onStart={openExportModal}
                onCancel={() => { exportCancelRef.current = true; exportAbortRef.current?.abort() }}
              />
              <button className="layers-add-btn layers-add-subtitle-btn" onClick={() => openSubtitleEditor()}>
                <Captions size={13} /> Add Subtitles
              </button>
              <button className="layers-add-btn" onClick={openMediaModal}>
                <Plus size={13} /> Add Layer
              </button>
            </div>
            <AssetList
              layers={project.layers}
              selectedLayerId={selectedLayerId}
              durationMs={(project.audio?.duration ?? 0) * 1000}
              currentTimeMs={currentTimeMs}
              onSelect={setSelectedLayerId}
              onUpdate={updateLayer}
              onUpdateTransient={updateLayerTransient}
              onTimingDragStart={snapshotForDrag}
              onRemove={removeLayer}
              onReorder={reorderLayers}
              onEditSubtitleLayer={editSubtitleLayer}
              onEditVideoLayer={openVideoSettingsModal}
            />
          </>
        )}

      </div>

      {modal?.type === 'media' && (
          <MediaModal
            onClose={closeModal}
            onAddTemplate={addTemplate}
            onUploadImage={(file) => void mediaLibrary.addUploadedImage(file)}
            onUploadVideo={(file) => void mediaLibrary.addUploadedVideo(file)}
            uploadedImages={mediaLibrary.sessionUploads}
            uploadedVideos={mediaLibrary.sessionVideos}
            onReuseImage={mediaLibrary.reuseUpload}
            onReuseVideo={mediaLibrary.reuseVideo}
          />
        )}

      {modal?.type === 'subtitle' && (() => {
        const editingLayer = project.layers.find((l) => l.id === modal.layerId) ?? null
        if (!editingLayer) return null
        return (
          <SubtitleModal
            onClose={closeModal}
            onSave={(cues) => updateSubtitleLayerCues(modal.layerId, cues)}
            editingLayer={editingLayer}
            onUpdateLayer={(patch) => updateLayer(modal.layerId, patch)}
            waveformPeaks={peaks}
            audioSrc={project.audio?.url ?? null}
            audioDuration={project.audio?.duration ?? 0}
          />
        )
      })()}

      {modal?.type === 'video-settings' && (() => {
        const vLayer = project.layers.find((l) => l.id === modal.layerId) ?? null
        if (!vLayer) return null
        return (
          <VideoSettingsModal
            layer={vLayer}
            onClose={closeModal}
            onUpdate={(patch) => updateLayer(modal.layerId, patch)}
          />
        )
      })()}

      {modal?.type === 'export' && (
        <ExportPanel
          hasAudio={hasAudio}
          suggestedTitle={suggestedExportTitle}
          isExportingPng={isExporting}
          isPreparing={isPreparing}
          preparePhase={preparePhase}
          prepareProgress={prepareProgress}
          isExportingVideo={isExportingVideo}
          videoProgress={exportVideoProgress}
          exportPhase={exportPhase}
          rendererMode={rendererMode}
          rendererDiagnostics={rendererDiagnostics}
          hasAudioEncoder={AUDIO_ENCODER_SUPPORTED}
          exportStats={exportStats}
          prerenderStats={prerenderStats}
          initialPresetId={preferredExportPresetId}
          onPresetChange={setPreferredExportPresetId}
          onExportPng={(title) => void exportPng(title)}
          onExportWebm={beginExportWebm}
          onCancelVideo={() => { exportCancelRef.current = true; exportAbortRef.current?.abort() }}
          lastExport={lastExport}
          onDownloadLastExport={() => void downloadLastExport()}
          onClearLastExport={clearLastExport}
          onClose={() => {
            if (isExportingVideo) return
            closeModal()
          }}
        />
      )}
    </div>
  )
}

type DownloadMediaButtonProps = {
  hasAudio: boolean
  isExportingVideo: boolean
  progress: number
  onStart: () => void
  onCancel: () => void
}

function DownloadMediaButton({ hasAudio, isExportingVideo, progress, onStart, onCancel }: DownloadMediaButtonProps) {
  const pct = Math.round(progress * 100)

  if (isExportingVideo) {
    return (
      <button className="dl-media-btn dl-media-btn--exporting" onClick={onCancel} title="Click to cancel">
        <div className="dl-media-fill" style={{ width: `${pct}%` }} />
        <Loader2 size={12} className="dl-media-spinner" />
        <span className="dl-media-label">Compiling… {pct}%</span>
        <X size={11} className="dl-media-cancel-icon" />
      </button>
    )
  }

  return (
    <button
      className="dl-media-btn"
      onClick={onStart}
      disabled={!hasAudio}
      title={hasAudio ? 'Download canvas + audio as WebM' : 'Add audio first'}
    >
      <Download size={12} />
      <span className="dl-media-label">Download Media</span>
    </button>
  )
}
