import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { AudioEngine } from '../../audio/AudioEngine'
import { silentAudioFeatures, type AudioFeatures } from '../../audio/audioTypes'
import { buildWaveformPeaks } from '../../audio/waveform'
import { createEntityId, nowIso } from '../../entities/entityTypes'
import type { Project } from '../../project/types'
import { idbDelete, idbPut } from '../../storage/idbStorage'
import type { StageHandle } from '../Stage'

const UI_FRAME_INTERVAL_MS = 100

type UseEditorPlaybackParams = {
  project: Project
  patchPresent: (recipe: (current: Project) => Project) => void
  commitProject: (recipe: (current: Project) => Project) => void
  stageRef: RefObject<StageHandle | null>
  exportActiveRef: RefObject<boolean>
  activeAudioObjectUrlRef: RefObject<string | null>
  registerObjectUrl: (url: string) => string
  revokeManagedObjectUrl: (url: unknown) => void
}

export function useEditorPlayback({
  project,
  patchPresent,
  commitProject,
  stageRef,
  exportActiveRef,
  activeAudioObjectUrlRef,
  registerObjectUrl,
  revokeManagedObjectUrl,
}: UseEditorPlaybackParams) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [meterFeatures, setMeterFeatures] = useState<AudioFeatures>(silentAudioFeatures)
  const [peaks, setPeaks] = useState<number[]>(new Array(160).fill(0.12))
  const [progress, setProgress] = useState(0)
  const [currentTimeMs, setCurrentTimeMs] = useState(0)

  const playbackTimeMsRef = useRef(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const engineRef = useRef<AudioEngine | null>(null)
  const rafRef = useRef<number | null>(null)
  const lastUiFrameRef = useRef(0)
  const tickRef = useRef<(time: number) => void>(() => {})

  const syncStageFrame = useCallback((timeMs: number) => {
    playbackTimeMsRef.current = timeMs
    const engine = engineRef.current
    const features = engine?.getFeatures() ?? silentAudioFeatures
    stageRef.current?.updateFrame(features, performance.now(), timeMs)
  }, [stageRef])

  const stopPlayback = useCallback(() => {
    audioRef.current?.pause()
    setIsPlaying(false)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
  }, [])

  const ensureAudioEngine = useCallback(async (audio: HTMLAudioElement) => {
    engineRef.current ??= new AudioEngine()
    engineRef.current.connect(audio)
    await engineRef.current.resume()
    return engineRef.current
  }, [])

  const tick = useCallback((time: number) => {
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
  }, [exportActiveRef, stageRef])
  tickRef.current = tick

  const togglePlayback = useCallback(async () => {
    const audio = audioRef.current
    if (!audio || !audio.src) return
    await ensureAudioEngine(audio)
    if (audio.paused) {
      await audio.play()
      setIsPlaying(true)
      rafRef.current = requestAnimationFrame(tickRef.current)
    } else {
      stopPlayback()
    }
  }, [ensureAudioEngine, stopPlayback])

  const seek = useCallback((ratio: number) => {
    const audio = audioRef.current
    if (!audio || !audio.duration) return
    audio.currentTime = ratio * audio.duration
    const ms = audio.currentTime * 1000
    setProgress(ratio)
    setCurrentTimeMs(ms)
    syncStageFrame(ms)
  }, [syncStageFrame])

  const handleAudioFile = useCallback(async (file: File) => {
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
      patchPresent((current) => ({
        ...current,
        audio: current.audio ? { ...current.audio, duration: audio.duration || 0, updatedAt: nowIso() } : audioEntity,
      }))
    }
    audio.src = url
    audio.load()

    const nextPeaks = await buildWaveformPeaks(file)
    setPeaks(nextPeaks)
  }, [
    activeAudioObjectUrlRef,
    commitProject,
    patchPresent,
    project.audio?.fileKey,
    registerObjectUrl,
    revokeManagedObjectUrl,
    stopPlayback,
  ])

  const onAudioEnded = useCallback(() => {
    setIsPlaying(false)
    setProgress(1)
  }, [])

  const resetPlaybackUi = useCallback(() => {
    setPeaks(new Array(160).fill(0.12))
    setProgress(0)
    setIsPlaying(false)
    setCurrentTimeMs(0)
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      audio?.pause()
    }
  }, [])

  return {
    audioRef,
    engineRef,
    rafRef,
    tickRef,
    playbackTimeMsRef,
    isPlaying,
    setIsPlaying,
    meterFeatures,
    peaks,
    setPeaks,
    progress,
    setProgress,
    currentTimeMs,
    setCurrentTimeMs,
    syncStageFrame,
    stopPlayback,
    ensureAudioEngine,
    togglePlayback,
    seek,
    handleAudioFile,
    onAudioEnded,
    resetPlaybackUi,
  }
}
