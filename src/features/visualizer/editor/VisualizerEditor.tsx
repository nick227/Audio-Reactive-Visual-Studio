import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Clapperboard, Captions, Download, Loader2, Maximize2, Minimize2, Monitor, Pause, Play, Plus, Smartphone, Upload, X } from 'lucide-react'
import html2canvas from 'html2canvas'
import { AudioEngine } from '../audio/AudioEngine'
import { buildWaveformPeaks } from '../audio/waveform'
import type { AudioFeatures } from '../audio/audioTypes'
import { silentAudioFeatures } from '../audio/audioTypes'
import { createDefaultProject } from '../project/defaultProject'
import { clearSavedProject, saveProject } from '../project/projectPersistence'
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
import { VideoSettingsModal } from './VideoSettingsModal'
import { idbPut, idbGet, idbDelete } from '../storage/idbStorage'
import { SiteTopBar } from '../../../components/SiteTopBar'

const UI_FRAME_INTERVAL_MS = 100
const MAX_HISTORY = 50

type HistoryState = {
  past: Project[]
  present: Project
  future: Project[]
}

const stagePresets: Array<{ id: StagePresetId; label: string; icon: typeof Smartphone; width: number; height: number }> = [
  { id: 'mobile', label: 'Mobile', icon: Smartphone, width: 1080, height: 1920 },
  { id: 'desktop', label: 'Desktop', icon: Monitor, width: 1920, height: 1080 },
  { id: 'film', label: 'Film', icon: Clapperboard, width: 2048, height: 858 },
]

// Shared layer-patch logic used by both committed and transient updaters.
function applyLayerPatch(layers: LayerInstance[], layerId: string, patch: Partial<LayerInstance>): LayerInstance[] {
  return layers.map((layer) =>
    layer.id === layerId
      ? {
          ...layer,
          ...patch,
          placement: { ...layer.placement, ...patch.placement },
          reaction: { ...layer.reaction, ...patch.reaction },
          settings: { ...layer.settings, ...patch.settings },
          timing: patch.timing ?? layer.timing,
          updatedAt: nowIso(),
        }
      : layer
  )
}

function cloneProject(p: Project): Project {
  return structuredClone(p)
}

export function VisualizerEditor() {
  const [history, setHistory] = useState<HistoryState>(() => ({
    past: [],
    present: createDefaultProject(),
    future: [],
  }))
  const project = history.present

  const [selectedLayerId, setSelectedLayerId] = useState(() => project.layers[project.layers.length - 1]?.id ?? '')
  const [isPlaying, setIsPlaying] = useState(false)
  const [meterFeatures, setMeterFeatures] = useState<AudioFeatures>(silentAudioFeatures)
  const [peaks, setPeaks] = useState<number[]>(new Array(160).fill(0.12))
  const [progress, setProgress] = useState(0)
  const [mediaOpen, setMediaOpen] = useState(false)
  const [sessionUploads, setSessionUploads] = useState<Array<{ id: string; name: string; url: string; fileKey: string }>>([])
  const [sessionVideos, setSessionVideos] = useState<Array<{ id: string; name: string; url: string; fileKey: string }>>([])
  const [isExporting, setIsExporting] = useState(false)
  const [isExportingVideo, setIsExportingVideo] = useState(false)
  const [exportVideoProgress, setExportVideoProgress] = useState(0)
  const [exportOpen, setExportOpen] = useState(false)
  const [exportSnapshot, setExportSnapshot] = useState<Project | null>(null)
  const stageProject = exportSnapshot ?? project
  const [subtitleOpen, setSubtitleOpen] = useState(false)
  const [videoSettingsLayerId, setVideoSettingsLayerId] = useState<string | null>(null)
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [fsUiIdle, setFsUiIdle] = useState(false)
  const fsIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [editingSubtitleLayerId, setEditingSubtitleLayerId] = useState<string | null>(null)
  const [currentTimeMs, setCurrentTimeMs] = useState(0)
  const playbackTimeMsRef = useRef(0)
  const exportActiveRef = useRef(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const engineRef = useRef<AudioEngine | null>(null)
  const rafRef = useRef<number | null>(null)
  const stageRef = useRef<StageHandle | null>(null)
  const lastUiFrameRef = useRef(0)
  const managedObjectUrlsRef = useRef(new Map<string, number>())
  const activeAudioObjectUrlRef = useRef<string | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tickRef = useRef<(time: number) => void>(() => {})
  const exportCancelRef = useRef(false)

  const syncStageFrame = useCallback((timeMs: number) => {
    playbackTimeMsRef.current = timeMs
    const engine = engineRef.current
    const features = engine?.getFeatures() ?? silentAudioFeatures
    stageRef.current?.updateFrame(features, performance.now(), timeMs)
  }, [])

  const activeStagePreset = useMemo(() => stagePresets.find((p) => p.width === project.stage.width && p.height === project.stage.height)?.id ?? 'desktop', [project.stage.height, project.stage.width])
  const hasAudio = Boolean(project.audio?.url)
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

  // ── History operations ──────────────────────────────────────────────────────

  // Updates present without touching past/future — used for live drag updates.
  const patchPresent = useCallback((recipe: (current: Project) => Project) => {
    setHistory((h) => ({ ...h, present: { ...recipe(h.present), updatedAt: nowIso() } }))
  }, [])

  // Commits a change to history. Clears the redo stack.
  const commitProject = useCallback((recipe: (current: Project) => Project) => {
    setHistory((h) => {
      const next = recipe(h.present)
      return {
        past: [...h.past.slice(-(MAX_HISTORY - 1)), h.present],
        present: { ...next, updatedAt: nowIso() },
        future: [],
      }
    })
  }, [])

  const undo = useCallback(() => {
    setHistory((h) => {
      if (!h.past.length) return h
      const previous = h.past[h.past.length - 1]
      return {
        past: h.past.slice(0, -1),
        present: previous,
        future: [h.present, ...h.future.slice(0, MAX_HISTORY - 1)],
      }
    })
  }, [])

  const redo = useCallback(() => {
    setHistory((h) => {
      if (!h.future.length) return h
      const next = h.future[0]
      return {
        past: [...h.past.slice(-(MAX_HISTORY - 1)), h.present],
        present: next,
        future: h.future.slice(1),
      }
    })
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

  // ── Persistence ─────────────────────────────────────────────────────────────

  // Debounced save — flush synchronously on cleanup so unmount/close doesn't lose the last edit.
  useEffect(() => {
    if (saveTimerRef.current !== null) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      saveProject(project)
      saveTimerRef.current = null
    }, 400)
    return () => {
      if (saveTimerRef.current !== null) {
        clearTimeout(saveTimerRef.current)
        saveProject(project)
        saveTimerRef.current = null
      }
    }
  }, [project])

  // ── Blob URL management ──────────────────────────────────────────────────────

  const registerObjectUrl = useCallback((url: string) => {
    if (url.startsWith('blob:')) {
      managedObjectUrlsRef.current.set(url, (managedObjectUrlsRef.current.get(url) ?? 0) + 1)
    }
    return url
  }, [])

  const revokeManagedObjectUrl = useCallback((url: unknown) => {
    if (typeof url !== 'string' || !url.startsWith('blob:')) return
    const count = managedObjectUrlsRef.current.get(url) ?? 0
    if (count <= 1) {
      URL.revokeObjectURL(url)
      managedObjectUrlsRef.current.delete(url)
      if (activeAudioObjectUrlRef.current === url) activeAudioObjectUrlRef.current = null
    } else {
      managedObjectUrlsRef.current.set(url, count - 1)
    }
  }, [])

  // Restore blob URLs from IndexedDB after initial load.
  useEffect(() => {
    async function restoreBlobs() {
      let anyChanged = false
      const restoredLayers = await Promise.all(
        project.layers.map(async (layer) => {
          const srcKey = layer.settings.srcKey
          if (typeof srcKey !== 'string' || !srcKey) return layer
          try {
            const blob = await idbGet(srcKey)
            if (!blob) return layer
            const url = registerObjectUrl(URL.createObjectURL(blob))
            anyChanged = true
            return { ...layer, settings: { ...layer.settings, src: url } }
          } catch {
            return layer
          }
        })
      )

      let restoredAudio = project.audio
      if (project.audio?.fileKey) {
        try {
          const blob = await idbGet(project.audio.fileKey)
          if (blob && audioRef.current) {
            const url = registerObjectUrl(URL.createObjectURL(blob))
            activeAudioObjectUrlRef.current = url
            audioRef.current.src = url
            audioRef.current.load()
            restoredAudio = { ...project.audio, url, updatedAt: nowIso() }
            const file = new File([blob], project.audio.filename, { type: blob.type })
            buildWaveformPeaks(file).then(setPeaks).catch(() => {})
            anyChanged = true
          }
        } catch {
          // IDB unavailable or entry missing — continue without audio
        }
      }

      if (anyChanged) {
        // Patch present only — blob restoration is not a user action.
        setHistory((h) => ({ ...h, present: { ...h.present, layers: restoredLayers, audio: restoredAudio } }))
      }
    }
    void restoreBlobs()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const audio = audioRef.current
    const urlMap = managedObjectUrlsRef.current
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      audio?.pause()
      for (const url of urlMap.keys()) URL.revokeObjectURL(url)
      urlMap.clear()
    }
  }, [])

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
    setHistory((h) => ({
      past: [...h.past.slice(-(MAX_HISTORY - 1)), h.present],
      present: h.present,
      future: [],
    }))
  }, [])

  const addTemplate = useCallback((templateId: string) => {
    const template = assetRegistry.get(templateId)
    if (!template) return
    const layer = template.createLayer()
    commitProject((current) => ({ ...current, layers: [...current.layers, layer] }))
    setSelectedLayerId(layer.id)
    setMediaOpen(false)
  }, [commitProject])

  const openSubtitleModal = useCallback((layerId?: string) => {
    if (layerId) {
      setEditingSubtitleLayerId(layerId)
      setSelectedLayerId(layerId)
    } else {
      const template = assetRegistry.get('subtitle-layer')
      if (!template) return
      const layer = template.createLayer()
      commitProject((current) => ({ ...current, layers: [...current.layers, layer] }))
      setSelectedLayerId(layer.id)
      setEditingSubtitleLayerId(layer.id)
    }
    setSubtitleOpen(true)
  }, [commitProject])

  const editSubtitleLayer = useCallback((layerId: string) => {
    openSubtitleModal(layerId)
  }, [openSubtitleModal])

  const updateSubtitleLayerCues = useCallback((layerId: string, cues: import('../subtitles/parseSrt').SrtCue[]) => {
    commitProject((current) => ({ ...current, layers: applyLayerPatch(current.layers, layerId, { settings: { cues } }) }))
  }, [commitProject])


  const addUploadedImage = useCallback(async (file: File) => {
    const template = assetRegistry.get('photo-cutout')
    if (!template) return
    const url = registerObjectUrl(URL.createObjectURL(file))
    const fileKey = `img_${Date.now()}_${file.name}`
    try { await idbPut(fileKey, file) } catch { /* IDB unavailable */ }
    const layer = template.createLayer({ name: file.name, settings: { src: url, srcKey: fileKey } })
    commitProject((current) => ({ ...current, layers: [...current.layers, layer] }))
    setSelectedLayerId(layer.id)
    setSessionUploads((prev) => [...prev, { id: fileKey, name: file.name, url, fileKey }])
    setMediaOpen(false)
  }, [commitProject, registerObjectUrl])

  const reuseUpload = useCallback((url: string, name: string, fileKey: string) => {
    const template = assetRegistry.get('photo-cutout')
    if (!template) return
    const layer = template.createLayer({ name, settings: { src: url, srcKey: fileKey } })
    commitProject((current) => ({ ...current, layers: [...current.layers, layer] }))
    setSelectedLayerId(layer.id)
    setMediaOpen(false)
  }, [commitProject])

  const addUploadedVideo = useCallback(async (file: File) => {
    const template = assetRegistry.get('video-layer')
    if (!template) return
    const url = registerObjectUrl(URL.createObjectURL(file))
    const fileKey = `vid_${Date.now()}_${file.name}`
    try { await idbPut(fileKey, file) } catch { /* IDB unavailable */ }
    const layer = template.createLayer({ name: file.name, settings: { src: url, srcKey: fileKey } })
    commitProject((current) => ({ ...current, layers: [...current.layers, layer] }))
    setSelectedLayerId(layer.id)
    setSessionVideos((prev) => [...prev, { id: fileKey, name: file.name, url, fileKey }])
    setMediaOpen(false)
  }, [commitProject, registerObjectUrl])

  const reuseVideo = useCallback((url: string, name: string, fileKey: string) => {
    const template = assetRegistry.get('video-layer')
    if (!template) return
    const layer = template.createLayer({ name, settings: { src: url, srcKey: fileKey } })
    commitProject((current) => ({ ...current, layers: [...current.layers, layer] }))
    setSelectedLayerId(layer.id)
    setMediaOpen(false)
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
    for (const url of managedObjectUrlsRef.current.keys()) URL.revokeObjectURL(url)
    managedObjectUrlsRef.current.clear()
    activeAudioObjectUrlRef.current = null
    if (audioRef.current) audioRef.current.src = ''
    const fresh = createDefaultProject()
    setHistory({ past: [], present: fresh, future: [] })
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

  const exportWebm = useCallback(async (snapshot: Project) => {
    const audio = audioRef.current
    const stageEl = stageRef.current?.getStageElement()
    if (!audio || !stageEl || !snapshot.audio?.duration) return
    const duration = snapshot.audio.duration

    flushSync(() => {
      setExportSnapshot(snapshot)
      setExportOpen(true)
    })

    const displayW = stageEl.offsetWidth
    const displayH = stageEl.offsetHeight
    const outputCanvas = document.createElement('canvas')
    outputCanvas.width = displayW
    outputCanvas.height = displayH
    const ctx = outputCanvas.getContext('2d')!

    // Include opus so MediaRecorder can mux the audio track alongside video.
    const mimeType = (
      ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'] as const
    ).find((t) => MediaRecorder.isTypeSupported(t)) ?? 'video/webm'

    // Init engine before building the stream so we can tap the audio output.
    audio.currentTime = 0
    audio.muted = true
    engineRef.current ??= new AudioEngine()
    engineRef.current.connect(audio)
    await engineRef.current.resume()
    engineRef.current.setOutputMuted(true)

    // Merge canvas video tracks with live audio tracks from the WebAudio graph.
    const videoTracks = outputCanvas.captureStream(30).getTracks()
    const audioStream = engineRef.current.getAudioStream()
    const recordStream = audioStream
      ? new MediaStream([...videoTracks, ...audioStream.getTracks()])
      : new MediaStream(videoTracks)

    const recorder = new MediaRecorder(recordStream, { mimeType, videoBitsPerSecond: 5_000_000 })
    const chunks: Blob[] = []
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }

    exportCancelRef.current = false
    exportActiveRef.current = true
    setIsExportingVideo(true)
    setExportVideoProgress(0)

    try {
      recorder.start(250)
      await audio.play()
      setIsPlaying(true)
      rafRef.current = requestAnimationFrame(tickRef.current)

      // Render frames into the output canvas. captureStream samples at 30fps.
      while (!exportCancelRef.current && !audio.ended && audio.currentTime < duration) {
        try {
          const frameMs = audio.currentTime * 1000
          setCurrentTimeMs(frameMs)
          syncStageFrame(frameMs)
          const frame = await html2canvas(stageEl, { scale: 1, useCORS: true, allowTaint: true, logging: false })
          ctx.drawImage(frame, 0, 0, displayW, displayH)
        } catch { /* skip frame */ }
        setExportVideoProgress(Math.min(audio.currentTime / duration, 1))
        // Yield so cancel button clicks and React state flush.
        await new Promise<void>((r) => setTimeout(r, 0))
      }

      stopPlayback()
      // Register onstop before calling stop() so the event is never missed.
      await new Promise<void>((r) => {
        recorder.addEventListener('stop', () => r(), { once: true })
        recorder.stop()
      })

      if (!exportCancelRef.current && chunks.length > 0) {
        const blob = new Blob(chunks, { type: mimeType })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${exportFileBase(snapshot.name)}.webm`
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 30_000)
      }
    } finally {
      audio.muted = false
      engineRef.current?.setOutputMuted(false)
      exportActiveRef.current = false
      setExportSnapshot(null)
      setIsExportingVideo(false)
      setExportVideoProgress(0)
    }
  }, [stopPlayback, syncStageFrame])

  const beginExportWebm = useCallback((title: string) => {
    const name = title.trim() || suggestedExportTitle
    persistExportTitle(title)
    const snapshot = cloneProject(project)
    snapshot.name = name
    void exportWebm(snapshot)
  }, [exportWebm, persistExportTitle, project, suggestedExportTitle])

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

      {!isFullScreen && <SiteTopBar />}

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
              onEditVideoLayer={setVideoSettingsLayerId}
            />

            {/* ── Layer list header ── */}
            <div className="layers-header">
              <DownloadMediaButton
                hasAudio={hasAudio}
                isExportingVideo={isExportingVideo}
                progress={exportVideoProgress}
                onStart={() => setExportOpen(true)}
                onCancel={() => { exportCancelRef.current = true }}
              />
              <button className="layers-add-btn layers-add-subtitle-btn" onClick={() => openSubtitleModal()}>
                <Captions size={13} /> Add Subtitles
              </button>
              <button className="layers-add-btn" onClick={() => setMediaOpen(true)}>
                <Plus size={13} /> Add Layer
              </button>
            </div>
          </>
        )}

      </div>

      {mediaOpen && (
          <MediaModal
            onClose={() => setMediaOpen(false)}
            onAddTemplate={addTemplate}
            onUploadImage={(file) => void addUploadedImage(file)}
            onUploadVideo={(file) => void addUploadedVideo(file)}
            uploadedImages={sessionUploads}
            uploadedVideos={sessionVideos}
            onReuseImage={reuseUpload}
            onReuseVideo={reuseVideo}
          />
        )}

      {subtitleOpen && editingSubtitleLayerId && (() => {
        const editingLayer = project.layers.find((l) => l.id === editingSubtitleLayerId) ?? null
        if (!editingLayer) return null
        return (
          <SubtitleModal
            onClose={() => { setSubtitleOpen(false); setEditingSubtitleLayerId(null) }}
            onSave={(cues) => updateSubtitleLayerCues(editingSubtitleLayerId, cues)}
            editingLayer={editingLayer}
            onUpdateLayer={(patch) => updateLayer(editingSubtitleLayerId, patch)}
            waveformPeaks={peaks}
            audioSrc={project.audio?.url ?? null}
            audioDuration={project.audio?.duration ?? 0}
          />
        )
      })()}

      {videoSettingsLayerId && (() => {
        const vLayer = project.layers.find((l) => l.id === videoSettingsLayerId) ?? null
        if (!vLayer) return null
        return (
          <VideoSettingsModal
            layer={vLayer}
            onClose={() => setVideoSettingsLayerId(null)}
            onUpdate={(patch) => updateLayer(videoSettingsLayerId, patch)}
          />
        )
      })()}

      {exportOpen && (
        <ExportPanel
          hasAudio={hasAudio}
          suggestedTitle={suggestedExportTitle}
          isExportingPng={isExporting}
          isExportingVideo={isExportingVideo}
          videoProgress={exportVideoProgress}
          onExportPng={(title) => void exportPng(title)}
          onExportWebm={beginExportWebm}
          onCancelVideo={() => { exportCancelRef.current = true }}
          onClose={() => {
            if (isExportingVideo) return
            setExportOpen(false)
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

