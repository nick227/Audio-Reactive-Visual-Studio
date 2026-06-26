import { useCallback, useMemo, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { flushSync } from 'react-dom'
import { toast } from 'sonner'
import html2canvas from 'html2canvas'
import { exportFileBase, suggestExportTitle } from '../../export/exportTitle'
import { computeOutputSize, type ExportPreset, type PresetId } from '../../export/presets'
import { prepareExport, ExportValidationError, type ExportRenderContext } from '../../export/prepare'
import {
  canUseNativeRenderer,
  createExportVideoElements,
  disposeExportVideoElements,
  renderCanvasFrame,
} from '../../export/renderCanvasFrame'
import { exportVideoWebCodecs, WEBCODECS_SUPPORTED, type FrameStats, type WebCodecsExportPhase } from '../../export/webcodecs'
import type { Project } from '../../project/types'
import { idbDelete, idbGet, idbPut } from '../../storage/idbStorage'
import { buildChunkFingerprintMap, buildPrerenderChunks, chunkIndexAtTime, type FrameChunkCache } from '../../prerender'
import type { LastExportMeta } from '../core/exportMeta'
import { clearLastExportMeta, loadLastExportMeta, saveLastExportMeta } from '../core/exportMeta'
import type { StageHandle } from '../Stage'

type ExportPlayback = {
  audioRef: RefObject<HTMLAudioElement | null>
  engineRef: RefObject<{ setOutputMuted: (muted: boolean) => void } | null>
  rafRef: RefObject<number | null>
  tickRef: RefObject<(time: number) => void>
  setIsPlaying: (isPlaying: boolean) => void
  setCurrentTimeMs: (timeMs: number) => void
  syncStageFrame: (timeMs: number) => void
  stopPlayback: () => void
  ensureAudioEngine: (audio: HTMLAudioElement) => Promise<{
    setOutputMuted: (muted: boolean) => void
    getAudioStream: () => MediaStream | undefined
  }>
}

type UseEditorExportParams = {
  project: Project
  commitProject: (recipe: (current: Project) => Project) => void
  stageRef: RefObject<StageHandle | null>
  playback: ExportPlayback
  exportActiveRef: RefObject<boolean>
  prerenderCacheRef: RefObject<FrameChunkCache>
  preferredExportPresetId: PresetId
  setPreferredExportPresetId: (presetId: PresetId) => void
  openExportModal: () => void
}

function cloneProject(project: Project): Project {
  return structuredClone(project)
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

export function useEditorExport({
  project,
  commitProject,
  stageRef,
  playback,
  exportActiveRef,
  prerenderCacheRef,
  preferredExportPresetId,
  setPreferredExportPresetId,
  openExportModal,
}: UseEditorExportParams) {
  const [isExporting, setIsExporting] = useState(false)
  const [isPreparing, setIsPreparing] = useState(false)
  const [preparePhase, setPreparePhase] = useState('')
  const [prepareProgress, setPrepareProgress] = useState(0)
  const [isExportingVideo, setIsExportingVideo] = useState(false)
  const [exportVideoProgress, setExportVideoProgress] = useState(0)
  const [exportPhase, setExportPhase] = useState<WebCodecsExportPhase | ''>('')
  const [exportSnapshot, setExportSnapshot] = useState<Project | null>(null)
  const [lastExport, setLastExport] = useState<LastExportMeta | null>(() => loadLastExportMeta())
  const [exportStats, setExportStats] = useState<FrameStats | null>(null)
  const exportCancelRef = useRef(false)
  const exportAbortRef = useRef<AbortController | null>(null)

  const stageProject = exportSnapshot ?? project
  const suggestedExportTitle = useMemo(
    () => suggestExportTitle(project.audio?.filename, project.name),
    [project.audio?.filename, project.name],
  )

  const persistExportTitle = useCallback((title: string) => {
    const name = title.trim() || suggestedExportTitle
    if (name === project.name) return
    commitProject((current) => ({ ...current, name }))
  }, [commitProject, project.name, suggestedExportTitle])

  const exportPng = useCallback(async (title: string) => {
    const stageEl = stageRef.current?.getStageElement()
    const audio = playback.audioRef.current
    if (!stageEl) return
    persistExportTitle(title)
    setIsExporting(true)
    try {
      const ms = (audio?.currentTime ?? 0) * 1000
      playback.syncStageFrame(ms)
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
  }, [persistExportTitle, playback, project.stage.width, stageRef, suggestedExportTitle])

  const exportWebm = useCallback(async (snapshot: Project, preset: ExportPreset) => {
    const audio = playback.audioRef.current
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

    const renderCompat = async (timeMs: number) => {
      playback.setCurrentTimeMs(timeMs)
      playback.syncStageFrame(timeMs)
      try {
        const frame = await html2canvas(stageEl, { scale: 1, useCORS: true, allowTaint: true, logging: false })
        ctx.drawImage(frame, 0, 0, outputW, outputH)
      } catch { /* non-fatal: skip frame */ }
    }

    const videoEls = canUseNativeRenderer(snapshot.layers)
      ? createExportVideoElements(snapshot.layers)
      : new Map<string, HTMLVideoElement>()

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
      toast.error('Rehearsal failed - the stage could not be rendered. Export aborted.')
      disposeExportVideoElements(videoEls)
      exportAbortRef.current = null
      exportActiveRef.current = false
      setExportSnapshot(null)
      return
    }

    setIsExportingVideo(true)
    setExportVideoProgress(0)
    setExportPhase('encoding-frames')
    setExportStats(null)

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
      try {
        const { blob } = await exportVideoWebCodecs({
          canvas: outputCanvas,
          fps: preset.fps,
          durationMs: duration * 1000,
          bitrate: preset.bitrate,
          audioUrl: snapshot.audio?.url,
          onProgress: (progress) => setExportVideoProgress(progress),
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
            } catch { /* IDB unavailable - download still proceeds */ }
            if (abort.signal.aborted) throw new DOMException('Export cancelled', 'AbortError')
            downloadBlob(blob, filename)
            console.log('[AVL Export] caller completion', { filename, mimeType, blobSize: blob.size })
          } finally {
            console.timeEnd('[AVL Export] caller completion/download')
          }
        }
      } catch (e) {
        if (!(e instanceof DOMException && e.name === 'AbortError')) {
          const message = e instanceof Error ? e.message : 'Video export failed. Try the MediaRecorder fallback.'
          toast.error(message)
          console.error('[WebCodecs export]', e)
        }
      } finally {
        cleanup()
      }
    } else {
      const mimeType = (
        ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'] as const
      ).find((type) => MediaRecorder.isTypeSupported(type)) ?? 'video/webm'

      audio.currentTime = 0
      const engine = await playback.ensureAudioEngine(audio)
      engine.setOutputMuted(true)

      const videoTracks = outputCanvas.captureStream(preset.fps).getTracks()
      const audioStream = engine.getAudioStream()
      const recordStream = audioStream
        ? new MediaStream([...videoTracks, ...audioStream.getTracks()])
        : new MediaStream(videoTracks)

      const recorder = new MediaRecorder(recordStream, { mimeType, videoBitsPerSecond: preset.bitrate })
      const chunks: Blob[] = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }

      try {
        recorder.start(250)
        await audio.play()
        playback.setIsPlaying(true)
        playback.rafRef.current = requestAnimationFrame(playback.tickRef.current)

        while (!exportCancelRef.current && !audio.ended && audio.currentTime < duration) {
          try {
            const frameMs = audio.currentTime * 1000
            playback.setCurrentTimeMs(frameMs)
            playback.syncStageFrame(frameMs)
            const frame = await html2canvas(stageEl, { scale: 1, useCORS: true, allowTaint: true, logging: false })
            ctx.drawImage(frame, 0, 0, outputW, outputH)
          } catch { /* skip frame */ }
          setExportVideoProgress(Math.min(audio.currentTime / duration, 1))
          await new Promise<void>((resolve) => setTimeout(resolve, 0))
        }

        playback.stopPlayback()
        await new Promise<void>((resolve) => {
          recorder.addEventListener('stop', () => resolve(), { once: true })
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
          } catch { /* IDB unavailable - download still proceeds */ }
          downloadBlob(blob, filename)
        }
      } finally {
        playback.engineRef.current?.setOutputMuted(false)
        cleanup()
      }
    }
  }, [openExportModal, playback, exportActiveRef, prerenderCacheRef, stageRef])

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
      downloadBlob(blob, lastExport.filename)
    } catch { /* IDB unavailable */ }
  }, [lastExport])

  const clearLastExport = useCallback(() => {
    void idbDelete('export-webm-last')
    clearLastExportMeta()
    setLastExport(null)
  }, [])

  const cancelVideoExport = useCallback(() => {
    exportCancelRef.current = true
    exportAbortRef.current?.abort()
  }, [])

  return {
    stageProject,
    suggestedExportTitle,
    isExporting,
    isPreparing,
    preparePhase,
    prepareProgress,
    isExportingVideo,
    exportVideoProgress,
    exportPhase,
    exportStats,
    preferredExportPresetId,
    setPreferredExportPresetId,
    lastExport,
    exportPng,
    beginExportWebm,
    downloadLastExport,
    clearLastExport,
    cancelVideoExport,
  }
}
