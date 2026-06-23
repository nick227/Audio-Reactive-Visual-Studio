import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Clapperboard, Captions, FilePlus, Image, Monitor, Pause, Play, Plus, Smartphone, Upload } from 'lucide-react'
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
import { Stage, type StageHandle } from './Stage'
import { Waveform } from './Waveform'
import { AssetList } from './AssetList'
import { MediaModal } from './MediaModal'
import { SubtitleModal } from './SubtitleModal'
import { ExportPanel } from './ExportPanel'
import { idbPut, idbGet, idbDelete } from '../storage/idbStorage'

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
          updatedAt: nowIso(),
        }
      : layer
  )
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
  const [subtitleOpen, setSubtitleOpen] = useState(false)
  const [editingSubtitleLayerId, setEditingSubtitleLayerId] = useState<string | null>(null)
  const [currentTimeMs, setCurrentTimeMs] = useState(0)
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

  const activeStagePreset = useMemo(() => stagePresets.find((p) => p.width === project.stage.width && p.height === project.stage.height)?.id ?? 'desktop', [project.stage.height, project.stage.width])
  const hasAudio = Boolean(project.audio?.url)

  // If the selected layer was removed by undo/redo, fall back to the topmost layer.
  useEffect(() => {
    if (selectedLayerId && !project.layers.find((l) => l.id === selectedLayerId)) {
      setSelectedLayerId(project.layers[project.layers.length - 1]?.id ?? '')
    }
  }, [project.layers, selectedLayerId])

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

  const togglePlaybackRef = useRef<() => void>(() => {})

  // ── Text editing ─────────────────────────────────────────────────────────────

  const [textEditLayerId, setTextEditLayerId] = useState<string | null>(null)
  const textEditLayerIdRef = useRef<string | null>(null)
  textEditLayerIdRef.current = textEditLayerId

  const handleLayerDoubleClick = useCallback((layerId: string) => {
    const layer = project.layers.find((l) => l.id === layerId)
    if (layer && String(layer.settings.visualKind) === 'typography') setTextEditLayerId(layerId)
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

  const addSubtitleLayer = useCallback((cues: import('../subtitles/parseSrt').SrtCue[]) => {
    const template = assetRegistry.get('subtitle-layer')
    if (!template) return
    const layer = template.createLayer({ settings: { cues } })
    commitProject((current) => ({ ...current, layers: [...current.layers, layer] }))
    setSelectedLayerId(layer.id)
  }, [commitProject])

  const editSubtitleLayer = useCallback((layerId: string) => {
    setEditingSubtitleLayerId(layerId)
    setSubtitleOpen(true)
  }, [])

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

  const duplicateLayer = useCallback(async (layerId: string) => {
    const layer = project.layers.find((l) => l.id === layerId)
    if (!layer) return
    const timestamp = nowIso()
    let newSettings = { ...layer.settings }

    const srcKey = layer.settings.srcKey
    if (typeof srcKey === 'string' && srcKey) {
      try {
        const blob = await idbGet(srcKey)
        if (blob) {
          const newKey = `img_${Date.now()}_copy`
          await idbPut(newKey, blob)
          const newUrl = registerObjectUrl(URL.createObjectURL(blob))
          newSettings = { ...newSettings, srcKey: newKey, src: newUrl }
        }
      } catch { /* IDB unavailable — share blob URL with ref counting */ }
    } else if (typeof layer.settings.src === 'string' && String(layer.settings.src).startsWith('blob:')) {
      registerObjectUrl(String(layer.settings.src))
    }

    const newLayer: LayerInstance = {
      ...layer,
      settings: newSettings,
      id: createEntityId('layer'),
      name: `${layer.name} (copy)`,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    commitProject((current) => {
      const index = current.layers.findIndex((l) => l.id === layerId)
      const layers = [...current.layers]
      layers.splice(index + 1, 0, newLayer)
      return { ...current, layers }
    })
    setSelectedLayerId(newLayer.id)
  }, [commitProject, project.layers, registerObjectUrl])

  const moveLayer = useCallback((layerId: string, direction: -1 | 1) => {
    commitProject((current) => {
      const layers = [...current.layers]
      const index = layers.findIndex((l) => l.id === layerId)
      const nextIndex = index + direction
      if (index < 0 || nextIndex < 0 || nextIndex >= layers.length) return current
      const [layer] = layers.splice(index, 1)
      layers.splice(nextIndex, 0, layer)
      return { ...current, layers }
    })
  }, [commitProject])

  const resetLayerPlacement = useCallback((layerId: string) => {
    updateLayer(layerId, {
      placement: { fit: 'contain', x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, anchor: 'center' },
    })
  }, [updateLayer])

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

  const exportPng = useCallback(async () => {
    const stageEl = stageRef.current?.getStageElement()
    if (!stageEl) return
    setIsExporting(true)
    try {
      const scale = project.stage.width / stageEl.offsetWidth
      const canvas = await html2canvas(stageEl, { scale, useCORS: true, allowTaint: true, logging: false })
      const url = canvas.toDataURL('image/png')
      const a = document.createElement('a')
      a.href = url
      a.download = `${project.name.replace(/\s+/g, '-').toLowerCase()}.png`
      a.click()
    } finally {
      setIsExporting(false)
    }
  }, [project.name, project.stage.width])

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
    stageRef.current?.updateFrame(features, time)

    if (time - lastUiFrameRef.current >= UI_FRAME_INTERVAL_MS) {
      lastUiFrameRef.current = time
      setMeterFeatures(features)
      setProgress(audio.duration ? audio.currentTime / audio.duration : 0)
      setCurrentTimeMs(audio.currentTime * 1000)
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
    setProgress(ratio)
  }

  const exportWebm = useCallback(async () => {
    const audio = audioRef.current
    const stageEl = stageRef.current?.getStageElement()
    if (!audio || !stageEl || !project.audio?.duration) return
    const duration = project.audio.duration

    const displayW = stageEl.offsetWidth
    const displayH = stageEl.offsetHeight
    const outputCanvas = document.createElement('canvas')
    outputCanvas.width = displayW
    outputCanvas.height = displayH
    const ctx = outputCanvas.getContext('2d')!

    const mimeType = (['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'] as const).find(
      (t) => MediaRecorder.isTypeSupported(t)
    ) ?? 'video/webm'

    const stream = outputCanvas.captureStream(15)
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2_500_000 })
    const chunks: Blob[] = []
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }

    exportCancelRef.current = false
    setIsExportingVideo(true)
    setExportVideoProgress(0)

    audio.currentTime = 0
    engineRef.current ??= new AudioEngine()
    engineRef.current.connect(audio)
    await engineRef.current.resume()

    recorder.start(250)
    await audio.play()
    setIsPlaying(true)
    rafRef.current = requestAnimationFrame(tickRef.current)

    // Draw html2canvas frames to the output canvas as fast as the browser allows.
    // captureStream samples the canvas at 15fps regardless of our frame rate.
    while (!exportCancelRef.current && !audio.ended && audio.currentTime < duration) {
      try {
        const frame = await html2canvas(stageEl, { scale: 1, useCORS: true, allowTaint: true, logging: false })
        ctx.drawImage(frame, 0, 0, displayW, displayH)
      } catch { /* skip frame */ }
      setExportVideoProgress(Math.min(audio.currentTime / duration, 1))
      // Yield to the event loop so cancel button clicks and React state flush.
      await new Promise<void>((r) => setTimeout(r, 0))
    }

    stopPlayback()
    recorder.stop()
    await new Promise<void>((r) => { recorder.onstop = () => r() })

    if (!exportCancelRef.current && chunks.length > 0) {
      const blob = new Blob(chunks, { type: mimeType })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${project.name.replace(/\s+/g, '-').toLowerCase()}-preview.webm`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 30_000)
    }

    setIsExportingVideo(false)
    setExportVideoProgress(0)
  }, [project.audio?.duration, project.name, stopPlayback])

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
    <div className="app-shell">
      <audio ref={audioRef} onEnded={() => { setIsPlaying(false); setProgress(1) }} />

      <div className="editor-body">

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
          </div>
          <div className="stage-viewport">
            <Stage
              ref={stageRef}
              project={project}
              selectedLayerId={selectedLayerId}
              onSelectLayer={(id) => { setSelectedLayerId(id); setTextEditLayerId(null) }}
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
        <AssetList
          layers={project.layers}
          selectedLayerId={selectedLayerId}
          onSelect={setSelectedLayerId}
          onUpdate={updateLayer}
          onRemove={removeLayer}
          onMove={moveLayer}
          onDuplicate={(id) => void duplicateLayer(id)}
          onResetPlacement={resetLayerPlacement}
          onEditSubtitleLayer={editSubtitleLayer}
        />

        {/* ── Layer list header ── */}
        <div className="layers-header">
          <button className="layers-add-btn" onClick={() => setMediaOpen(true)}>
            <Plus size={13} /> Add Layer
          </button>
          <button className="layers-add-btn layers-add-subtitle-btn" onClick={() => setSubtitleOpen(true)}>
            <Captions size={13} /> Add Subtitles
          </button>
        </div>

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

      {subtitleOpen && (() => {
        const editingLayer = editingSubtitleLayerId
          ? project.layers.find((l) => l.id === editingSubtitleLayerId) ?? null
          : null
        return (
          <SubtitleModal
            onClose={() => { setSubtitleOpen(false); setEditingSubtitleLayerId(null) }}
            onSave={(cues) => {
              if (editingSubtitleLayerId) {
                updateSubtitleLayerCues(editingSubtitleLayerId, cues)
              } else {
                addSubtitleLayer(cues)
              }
            }}
            editingLayer={editingLayer}
            onUpdateLayer={editingSubtitleLayerId
              ? (patch) => updateLayer(editingSubtitleLayerId, patch)
              : undefined
            }
            waveformPeaks={peaks}
            audioSrc={project.audio?.url ?? null}
            audioDuration={project.audio?.duration ?? 0}
          />
        )
      })()}

      {exportOpen && (
        <ExportPanel
          hasAudio={hasAudio}
          isExportingPng={isExporting}
          isExportingVideo={isExportingVideo}
          videoProgress={exportVideoProgress}
          onExportPng={() => void exportPng()}
          onExportWebm={() => void exportWebm()}
          onCancelVideo={() => { exportCancelRef.current = true }}
          onClose={() => setExportOpen(false)}
        />
      )}
    </div>
  )
}

