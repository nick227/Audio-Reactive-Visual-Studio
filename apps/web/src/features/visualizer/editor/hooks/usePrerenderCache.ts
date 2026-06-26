import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { PresetId } from '../../export/presets'
import { computeOutputSize, getPreset } from '../../export/presets'
import { prepareExport, type ExportRenderContext } from '../../export/prepare'
import {
  createExportVideoElements,
  disposeExportVideoElements,
  renderCanvasFrame,
} from '../../export/renderCanvasFrame'
import type { Project } from '../../project/types'
import {
  FrameChunkCache,
  buildChunkFingerprintMap,
  buildPrerenderChunks,
  chunkFrameRange,
  detectDirtyChunkIndexes,
  frameTimeMs,
  prioritizeDirtyChunks,
  scheduleIdleTask,
  type CachedChunkStats,
  type RenderChunkIdentity,
} from '../../prerender'
import type { StageHandle } from '../Stage'

type UsePrerenderCacheParams = {
  project: Project
  hasAudio: boolean
  rendererMode: 'native' | 'compat'
  isPreparing: boolean
  isExportingVideo: boolean
  preferredExportPresetId: PresetId
  prerenderCacheRef: RefObject<FrameChunkCache>
  stageRef: RefObject<StageHandle | null>
  playbackTimeMsRef: RefObject<number>
}

function cloneProject(project: Project): Project {
  return structuredClone(project)
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

export function usePrerenderCache({
  project,
  hasAudio,
  rendererMode,
  isPreparing,
  isExportingVideo,
  preferredExportPresetId,
  prerenderCacheRef,
  stageRef,
  playbackTimeMsRef,
}: UsePrerenderCacheParams) {
  const [prerenderStats, setPrerenderStats] = useState<CachedChunkStats>({
    preparedChunks: 0,
    totalChunks: 0,
    cachedFrames: 0,
  })
  const prerenderFingerprintsRef = useRef<Map<number, RenderChunkIdentity> | null>(null)
  const prerenderRevisionRef = useRef(0)

  const updatePrerenderStats = useCallback((totalChunks: number, identities?: Iterable<RenderChunkIdentity>) => {
    setPrerenderStats(prerenderCacheRef.current.stats(totalChunks, identities))
  }, [])

  useEffect(() => {
    const durationMs = (project.audio?.duration ?? 0) * 1000
    if (!hasAudio || durationMs <= 0 || rendererMode !== 'native' || isPreparing || isExportingVideo) {
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
    playbackTimeMsRef,
    prerenderCacheRef,
    preferredExportPresetId,
    project,
    rendererMode,
    stageRef,
    updatePrerenderStats,
  ])

  useEffect(() => () => prerenderCacheRef.current.clear(), [])

  return { prerenderStats }
}
