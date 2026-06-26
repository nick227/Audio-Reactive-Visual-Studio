import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { buildWaveformPeaks } from '../../audio/waveform'
import { assetRegistry } from '../../assets/registry'
import { nowIso } from '../../entities/entityTypes'
import type { Project } from '../../project/types'
import { idbGet, idbPut } from '../../storage/idbStorage'

export type MediaLibraryItem = {
  id: string
  name: string
  url: string
  fileKey: string
}

type UseMediaLibraryParams = {
  project: Project
  patchPresent: (recipe: (current: Project) => Project) => void
  commitProject: (recipe: (current: Project) => Project) => void
  audioRef: RefObject<HTMLAudioElement | null>
  activeAudioObjectUrlRef: RefObject<string | null>
  registerObjectUrl: (url: string) => string
  setSelectedLayerId: (layerId: string) => void
  setPeaks: (peaks: number[]) => void
  closeModal: () => void
}

export function useMediaLibrary({
  project,
  patchPresent,
  commitProject,
  audioRef,
  activeAudioObjectUrlRef,
  registerObjectUrl,
  setSelectedLayerId,
  setPeaks,
  closeModal,
}: UseMediaLibraryParams) {
  const [sessionUploads, setSessionUploads] = useState<MediaLibraryItem[]>([])
  const [sessionVideos, setSessionVideos] = useState<MediaLibraryItem[]>([])
  const restoredForIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (restoredForIdRef.current === project.id) return
    restoredForIdRef.current = project.id
    setSessionUploads([])
    setSessionVideos([])

    async function restoreBlobs() {
      let anyChanged = false
      const restoredUploads: MediaLibraryItem[] = []
      const restoredVideos: MediaLibraryItem[] = []

      const restoredLayers = await Promise.all(
        project.layers.map(async (layer) => {
          const srcKey = layer.settings.srcKey
          if (typeof srcKey !== 'string' || !srcKey) return layer
          try {
            const blob = await idbGet(srcKey)
            if (!blob) return layer
            const url = registerObjectUrl(URL.createObjectURL(blob))
            anyChanged = true
            const entry = { id: srcKey, name: layer.name, url, fileKey: srcKey }
            if (srcKey.startsWith('img_')) restoredUploads.push(entry)
            else if (srcKey.startsWith('vid_')) restoredVideos.push(entry)
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
          // IDB unavailable or entry missing; continue without restored audio.
        }
      }

      if (restoredUploads.length) setSessionUploads(restoredUploads)
      if (restoredVideos.length) setSessionVideos(restoredVideos)

      if (anyChanged) {
        patchPresent((current) => ({ ...current, layers: restoredLayers, audio: restoredAudio }))
      }
    }

    void restoreBlobs()
  }, [activeAudioObjectUrlRef, audioRef, patchPresent, project, project.id, registerObjectUrl, setPeaks])

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
    closeModal()
  }, [closeModal, commitProject, registerObjectUrl, setSelectedLayerId])

  const reuseUpload = useCallback((url: string, name: string, fileKey: string) => {
    const template = assetRegistry.get('photo-cutout')
    if (!template) return
    const layer = template.createLayer({ name, settings: { src: url, srcKey: fileKey } })
    commitProject((current) => ({ ...current, layers: [...current.layers, layer] }))
    setSelectedLayerId(layer.id)
    closeModal()
  }, [closeModal, commitProject, setSelectedLayerId])

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
    closeModal()
  }, [closeModal, commitProject, registerObjectUrl, setSelectedLayerId])

  const reuseVideo = useCallback((url: string, name: string, fileKey: string) => {
    const template = assetRegistry.get('video-layer')
    if (!template) return
    const layer = template.createLayer({ name, settings: { src: url, srcKey: fileKey } })
    commitProject((current) => ({ ...current, layers: [...current.layers, layer] }))
    setSelectedLayerId(layer.id)
    closeModal()
  }, [closeModal, commitProject, setSelectedLayerId])

  return {
    sessionUploads,
    sessionVideos,
    addUploadedImage,
    reuseUpload,
    addUploadedVideo,
    reuseVideo,
  }
}
