import { createContext, forwardRef, memo, useCallback, useContext, useEffect, useImperativeHandle, useMemo, useRef, type CSSProperties } from 'react'
import type { AudioFeatures } from '../audio/audioTypes'
import { silentAudioFeatures } from '../audio/audioTypes' // silentAudioFeatures used for initial StageLayer render
import type { LayerInstance, Project } from '../project/types'
import { assetRegistry } from '../assets/registry'
import { audioValue, computeLayerTransform } from '../runtime/effects'
import { layerHostStyle } from '../runtime/layerStyles'
import { applyLayerFrame } from '../runtime/domRuntime'
import { MicroEventEngine } from '../runtime/microEventEngine'
import { LayerErrorBoundary } from './LayerErrorBoundary'
import { PuppetCanvasLayer } from './PuppetCanvasLayer'
import { SubtitleLayer } from './SubtitleLayer'
import { clampSubtitleWidth, DEFAULT_SUBTITLE_WIDTH, subtitleHandleInset } from '../subtitles/layout'
import { isTypographyLayer, resolveVisualKind } from '../runtime/layerVisualKind'
import { puppetRuntimeHost } from '../runtime/puppetRuntimeHost'

export type StageHandle = {
  updateFrame: (features: AudioFeatures, time: number, currentTimeMs?: number) => void
  getStageElement: () => HTMLDivElement | null
}

type VideoAnalyserEntry = { analyser: AnalyserNode; data: Uint8Array<ArrayBuffer> }
// Shared registry so VideoLayerPlayer can register analysers that updateFrame reads.
const VideoAnalyserContext = createContext<React.MutableRefObject<Map<string, VideoAnalyserEntry>>>(
  { current: new Map() }
)

type Props = {
  project: Project
  selectedLayerId: string
  isPlaying: boolean
  onSelectLayer: (layerId: string) => void
  onUpdateLayer: (layerId: string, patch: Partial<LayerInstance>) => void
  onDragStart?: () => void
  onDoubleClickLayer?: (layerId: string) => void
  editingLayerId?: string | null
  onTextChange?: (layerId: string, text: string) => void
  onTextCommit?: (layerId: string, text: string) => void
  currentTimeMs?: number
}

export const Stage = forwardRef<StageHandle, Props>(function Stage(
  { project, selectedLayerId, isPlaying, onSelectLayer, onUpdateLayer, onDragStart, onDoubleClickLayer, editingLayerId, onTextChange, onTextCommit, currentTimeMs = 0 },
  ref,
) {
  const layerRefs = useRef(new Map<string, HTMLDivElement>())
  const stageElRef = useRef<HTMLDivElement>(null)
  const projectRef = useRef(project)
  projectRef.current = project
  const smoothedValuesRef = useRef(new Map<string, number>())
  const microEventEngineRef = useRef(new MicroEventEngine())
  const videoAnalysersRef = useRef(new Map<string, VideoAnalyserEntry>())
  const stageRatio = `${project.stage.width} / ${project.stage.height}`
  const durationMs = (project.audio?.duration ?? 0) * 1000

  useImperativeHandle(ref, () => ({
    getStageElement: () => stageElRef.current,
    updateFrame(features, time, currentTimeMs = 0) {
      const current = projectRef.current
      const audioDurationMs = (current.audio?.duration ?? 0) * 1000
      puppetRuntimeHost.setFeatures(features)
      const activeEffects = microEventEngineRef.current.tick(features, time, current.microEvents ?? [])

      for (const layer of current.layers) {
        const el = layerRefs.current.get(layer.id)
        if (el) {
          // When bassSource === 'video', read bass from the video's own AudioAnalyser.
          let raw: number
          if (layer.settings.bassSource === 'video') {
            const entry = videoAnalysersRef.current.get(layer.id)
            if (entry) {
              entry.analyser.getByteFrequencyData(entry.data)
              let sum = 0
              const end = Math.min(12, entry.data.length)
              for (let i = 0; i < end; i++) sum += entry.data[i]
              raw = Math.min(1, (sum / end / 255) * 1.35)
            } else {
              raw = audioValue(features, layer.reaction.trigger)
            }
          } else {
            raw = audioValue(features, layer.reaction.trigger)
          }

          const prev = smoothedValuesRef.current.get(layer.id) ?? raw
          const smoothed = prev * layer.reaction.smoothness + raw * (1 - layer.reaction.smoothness)
          smoothedValuesRef.current.set(layer.id, smoothed)

          const microEffect = layer.role ? activeEffects.get(layer.role) : undefined
          applyLayerFrame(el, layer, features, smoothed, time, current.stage, microEffect, currentTimeMs, audioDurationMs)

          // Per-bar audio update for audioVisualizer layers
          if (features.bins) {
            const visualKind = resolveVisualKind(layer)
            if (visualKind === 'audioVisualizer') {
              const barsDiv = el.firstElementChild
              if (barsDiv) {
                const barEls = barsDiv.children
                const n = barEls.length
                const bins = features.bins
                for (let bi = 0; bi < n; bi++) {
                  const binIdx = Math.floor((bi / n) * bins.length)
                  ;(barEls[bi] as HTMLElement).style.setProperty('--h', `${Math.round(bins[binIdx] * 100)}%`)
                }
              }
            }
          }
        }
      }
    },
  }), [])

  const bindLayerRef = useCallback((layerId: string, node: HTMLDivElement | null) => {
    if (node) layerRefs.current.set(layerId, node)
    else layerRefs.current.delete(layerId)
  }, [])

  const handleDoubleClick = useCallback((layerId: string) => {
    onDoubleClickLayer?.(layerId)
  }, [onDoubleClickLayer])

  return (
    <VideoAnalyserContext.Provider value={videoAnalysersRef}>
      <div className="stage-wrap">
        <div ref={stageElRef} className="stage" style={{ aspectRatio: stageRatio, background: project.stage.backgroundColor }} onPointerDown={() => onSelectLayer('')}>
          {project.layers.map((layer) => (
            <LayerErrorBoundary key={layer.id} name={layer.name}>
              <StageLayer
                layer={layer}
                selected={selectedLayerId === layer.id}
                stageWidth={project.stage.width}
                stageHeight={project.stage.height}
                setRef={bindLayerRef}
                onSelectLayer={onSelectLayer}
                onUpdateLayer={onUpdateLayer}
                onDragStart={onDragStart}
                onDoubleClick={handleDoubleClick}
                isEditing={layer.id === (editingLayerId ?? '')}
                isPlaying={isPlaying}
                onTextChange={onTextChange}
                onTextCommit={onTextCommit}
                currentTimeMs={currentTimeMs}
                durationMs={durationMs}
              />
            </LayerErrorBoundary>
          ))}
        </div>
      </div>
    </VideoAnalyserContext.Provider>
  )
})

type LayerProps = {
  layer: LayerInstance
  selected: boolean
  stageWidth: number
  stageHeight: number
  setRef: (layerId: string, node: HTMLDivElement | null) => void
  onSelectLayer: (layerId: string) => void
  onUpdateLayer: (layerId: string, patch: Partial<LayerInstance>) => void
  onDragStart?: () => void
  onDoubleClick?: (layerId: string) => void
  isEditing: boolean
  isPlaying: boolean
  onTextChange?: (layerId: string, text: string) => void
  onTextCommit?: (layerId: string, text: string) => void
  currentTimeMs: number
  durationMs: number
}

const StageLayer = memo(function StageLayer({ layer, selected, stageWidth, stageHeight, setRef, onSelectLayer, onUpdateLayer, onDragStart, onDoubleClick, isEditing, isPlaying, onTextChange, onTextCommit, currentTimeMs, durationMs }: LayerProps) {
  const template = assetRegistry.get(layer.templateId)
  const hostRef = useRef<HTMLDivElement | null>(null)
  const initialTransform = computeLayerTransform(layer, silentAudioFeatures, 0)
  const stageSize = useMemo(() => ({ width: stageWidth, height: stageHeight }), [stageHeight, stageWidth])
  const style = layerHostStyle(layer, initialTransform, stageSize, currentTimeMs, durationMs)
  const isVideo = layer.templateId === 'video-layer'
  const content = useMemo(
    () => (isEditing || isVideo) ? null : renderLayerContent(layer, currentTimeMs),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [layer.id, layer.templateId, layer.settings, layer.settings.color, layer.name, layer.placement.fit, layer.timing, layer.visible, isEditing, currentTimeMs, isVideo],
  )

  if (!template) return null

  const isSubtitle = resolveVisualKind(layer) === 'subtitle'
  const isTypography = isTypographyLayer(layer)
  const counterScale = 1 / Math.max(0.01, layer.placement.scale)
  const subtitleWidth = Number(layer.settings.subtitleWidth ?? DEFAULT_SUBTITLE_WIDTH)
  const subtitleInset = subtitleHandleInset(subtitleWidth)

  const handleResizeStart = (e: React.PointerEvent<HTMLDivElement>, cursor: string) => {
    if (layer.locked) return
    e.stopPropagation()
    onSelectLayer(layer.id)
    onDragStart?.()

    const stageEl = e.currentTarget.closest<HTMLElement>('.stage')
    const stageBounds = stageEl?.getBoundingClientRect()
    if (!stageBounds) return

    // Build the move handler; early-return before committing to capture/drag.
    let move: (e: PointerEvent) => void = () => {}

    if (isSubtitle) {
      // Subtitle resize: drag side handles to set cue width as % of stage.
      const centerX = stageBounds.left + (0.5 + layer.placement.x / stageWidth) * stageBounds.width
      const startHalfWidth = Math.abs(e.clientX - centerX)
      if (startHalfWidth < 8) return
      const startWidth = Number(layer.settings.subtitleWidth ?? DEFAULT_SUBTITLE_WIDTH)
      move = (me: PointerEvent) => {
        const nextHalfWidth = Math.abs(me.clientX - centerX)
        const nextWidth = clampSubtitleWidth(startWidth * (nextHalfWidth / startHalfWidth))
        onUpdateLayer(layer.id, {
          settings: { subtitleWidth: nextWidth },
        })
      }
    } else {
      // Normal layer resize: scale placement relative to layer center.
      const centerX = stageBounds.left + (0.5 + layer.placement.x / stageWidth) * stageBounds.width
      const centerY = stageBounds.top + (0.5 + layer.placement.y / stageHeight) * stageBounds.height
      const startDist = Math.hypot(e.clientX - centerX, e.clientY - centerY)
      if (startDist < 5) return
      const startScale = layer.placement.scale
      const startFit = layer.placement.fit === 'contain' ? 'custom' : layer.placement.fit
      move = (me: PointerEvent) => {
        const newDist = Math.hypot(me.clientX - centerX, me.clientY - centerY)
        onUpdateLayer(layer.id, {
          placement: {
            x: layer.placement.x, y: layer.placement.y,
            rotation: layer.placement.rotation, opacity: layer.placement.opacity,
            anchor: layer.placement.anchor,
            scale: startScale * (newDist / startDist),
            fit: startFit,
          },
        })
      }
    }

    const host = hostRef.current
    host?.classList.add('is-resizing')
    document.body.style.cursor = cursor
    document.body.style.userSelect = 'none'
    e.currentTarget.setPointerCapture(e.pointerId)

    const cleanup = () => {
      host?.classList.remove('is-resizing')
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', cleanup)
      window.removeEventListener('pointercancel', cleanup)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', cleanup)
    window.addEventListener('pointercancel', cleanup)
  }

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (layer.locked) return
    event.stopPropagation()
    onSelectLayer(layer.id)

    const el = event.currentTarget
    const stageEl = el.closest<HTMLElement>('.stage')
    const stageBounds = stageEl?.getBoundingClientRect()
    if (!stageBounds) return

    const startClientX = event.clientX
    const startClientY = event.clientY
    let dragging = false

    let move: (e: PointerEvent) => void = () => {}
    const cleanup = (e: PointerEvent) => {
      document.body.style.userSelect = ''
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', cleanup)
      window.removeEventListener('pointercancel', cleanup)
      if (e.type === 'pointerup' && !dragging && selected && isTypography && !isEditing) onDoubleClick?.(layer.id)
    }

    if (isSubtitle) {
      const scaleX = stageBounds.width ? stageWidth / stageBounds.width : 1
      const scaleY = stageBounds.height ? stageHeight / stageBounds.height : 1
      const originX = layer.placement.x
      const originY = layer.placement.y
      move = (me: PointerEvent) => {
        if (!dragging) {
          if (Math.hypot(me.clientX - startClientX, me.clientY - startClientY) < 4) return
          dragging = true
          onDragStart?.()
          document.body.style.userSelect = 'none'
          el.setPointerCapture(me.pointerId)
        }
        onUpdateLayer(layer.id, {
          placement: {
            ...layer.placement,
            fit: 'custom',
            x: originX + (me.clientX - startClientX) * scaleX,
            y: originY + (me.clientY - startClientY) * scaleY,
          },
        })
      }
    } else {
      const scaleX = stageBounds.width ? stageWidth / stageBounds.width : 1
      const scaleY = stageBounds.height ? stageHeight / stageBounds.height : 1
      const originX = layer.placement.x
      const originY = layer.placement.y
      move = (me: PointerEvent) => {
        if (!dragging) {
          if (Math.hypot(me.clientX - startClientX, me.clientY - startClientY) < 4) return
          dragging = true
          onDragStart?.()
          document.body.style.userSelect = 'none'
          el.setPointerCapture(me.pointerId)
        }
        onUpdateLayer(layer.id, {
          placement: {
            ...layer.placement,
            fit: 'custom',
            x: originX + (me.clientX - startClientX) * scaleX,
            y: originY + (me.clientY - startClientY) * scaleY,
          },
        })
      }
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', cleanup)
    window.addEventListener('pointercancel', cleanup)
  }

  return (
    <div
      ref={(node) => { hostRef.current = node; setRef(layer.id, node) }}
      className={`stage-layer ${selected ? 'selected' : ''}${isSubtitle ? ' subtitle-host' : ''}${isTypography ? ' typography-host' : ''}`}
      style={isSubtitle ? { ...style, pointerEvents: 'none' } : style}
      onPointerDown={onPointerDown}
      onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick?.(layer.id) }}
    >
      {isEditing
        ? <TypographyLayerEditing layer={layer} onTextChange={onTextChange} onTextCommit={onTextCommit} />
        : isVideo
          ? <VideoLayerPlayer layer={layer} isPlaying={isPlaying} />
          : content
      }
      {!isEditing && (
        <div className="resize-overlay">
          <div className="resize-frame" />
          {!isSubtitle && !layer.locked && (
            <>
              <div className="resize-handle resize-handle-nw" style={{ transform: `scale(${counterScale})` }} onPointerDown={(e) => handleResizeStart(e, 'nw-resize')} />
              <div className="resize-handle resize-handle-ne" style={{ transform: `scale(${counterScale})` }} onPointerDown={(e) => handleResizeStart(e, 'ne-resize')} />
              <div className="resize-handle resize-handle-sw" style={{ transform: `scale(${counterScale})` }} onPointerDown={(e) => handleResizeStart(e, 'sw-resize')} />
              <div className="resize-handle resize-handle-se" style={{ transform: `scale(${counterScale})` }} onPointerDown={(e) => handleResizeStart(e, 'se-resize')} />
            </>
          )}
          {isSubtitle && !layer.locked && (
            <>
              <div
                className="resize-handle resize-handle-sub-l"
                style={{ bottom: `${Number(layer.settings.subtitleOffsetY ?? 0)}%`, left: `${subtitleInset}%` }}
                onPointerDown={(e) => handleResizeStart(e, 'ew-resize')}
              />
              <div
                className="resize-handle resize-handle-sub-r"
                style={{ bottom: `${Number(layer.settings.subtitleOffsetY ?? 0)}%`, right: `${subtitleInset}%` }}
                onPointerDown={(e) => handleResizeStart(e, 'ew-resize')}
              />
            </>
          )}
        </div>
      )}
    </div>
  )
})

// ── VideoLayerPlayer ─────────────────────────────────────────────────────────

function VideoLayerPlayer({ layer, isPlaying }: { layer: LayerInstance; isPlaying: boolean }) {
  const src = String(layer.settings.src ?? '')
  const startMs    = Number(layer.settings.videoStartMs ?? 0)
  const endMs      = layer.settings.videoEndMs != null ? Number(layer.settings.videoEndMs) : null
  const rate       = Number(layer.settings.playbackRate ?? 1)
  const loop       = layer.settings.videoLoop !== false
  const bassSource = String(layer.settings.bassSource ?? 'main')
  const muted      = bassSource !== 'video'

  const videoRef     = useRef<HTMLVideoElement>(null)
  const audioCtxRef  = useRef<AudioContext | null>(null)
  const capturedRef  = useRef(false)
  const analysersRef = useContext(VideoAnalyserContext)

  // Sync play / pause with main transport
  useEffect(() => {
    const v = videoRef.current
    if (!v || !v.src) return
    if (isPlaying) void v.play().catch(() => {})
    else v.pause()
  }, [isPlaying])

  // Playback rate
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    v.playbackRate = rate
  }, [rate])

  // End cap — timeupdate resets to start when we pass the out point
  useEffect(() => {
    const v = videoRef.current
    if (!v || endMs === null) return
    const handle = () => {
      if (v.currentTime >= endMs / 1000) {
        v.currentTime = startMs / 1000
        if (!loop) v.pause()
      }
    }
    v.addEventListener('timeupdate', handle)
    return () => v.removeEventListener('timeupdate', handle)
  }, [endMs, startMs, loop])

  // Bass FX — create a silent AudioContext tapping this video's audio track
  useEffect(() => {
    const v = videoRef.current
    if (!v || bassSource !== 'video' || capturedRef.current) return

    try {
      const ctx = new AudioContext()
      audioCtxRef.current = ctx
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      analyser.smoothingTimeConstant = 0.72
      // Route through WebAudio but don't connect to destination → silent analysis
      ctx.createMediaElementSource(v).connect(analyser)
      const data = new Uint8Array(analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>
      analysersRef.current.set(layer.id, { analyser, data })
      capturedRef.current = true
      void ctx.resume()
    } catch { /* createMediaElementSource can only be called once per element */ }

    return () => {
      analysersRef.current.delete(layer.id)
      if (audioCtxRef.current) {
        void audioCtxRef.current.close()
        audioCtxRef.current = null
      }
      capturedRef.current = false
    }
  }, [bassSource, layer.id, analysersRef])

  if (!src) return <div className="image-placeholder">Upload<br />Video</div>

  return (
    <video
      ref={videoRef}
      className="video-layer"
      src={src}
      muted={muted}
      playsInline
      loop={loop && endMs === null}
      onLoadedData={() => {
        const v = videoRef.current
        if (!v) return
        v.currentTime = startMs / 1000
        v.playbackRate = rate
        if (isPlaying) void v.play().catch(() => {})
      }}
    />
  )
}

// ── renderLayerContent ────────────────────────────────────────────────────────

function renderLayerContent(layer: LayerInstance, currentTimeMs: number = 0) {
  const visualKind = resolveVisualKind(layer)
  const color = String(layer.settings.color ?? '#ffffff')

  if (layer.templateId === 'photo-cutout') {
    return layer.settings.src ? <img className="image-layer" src={String(layer.settings.src)} alt={layer.name} draggable={false} /> : <div className="image-placeholder">Upload<br />Image</div>
  }

  switch (visualKind) {
    case 'gradient':
      return (
        <div
          className="layer-box studio-gradient"
          style={{
            ['--a' as string]: String(layer.settings.colorA ?? '#5b4bff'),
            ['--b' as string]: String(layer.settings.colorB ?? '#ff4fd8'),
            ['--c' as string]: String(layer.settings.colorC ?? '#00e0ff'),
          }}
        />
      )
    case 'texture':
      return <div className={`layer-box studio-texture texture-${layer.settings.textureKind ?? 'grain'}`} style={{ color }} />
    case 'particles':
      return <ParticleLayer color={color} kind={String(layer.settings.particleKind ?? 'sparkles')} density={Number(layer.settings.density ?? 42)} />
    case 'shape':
      return <div className={`layer-box studio-shape shape-${layer.settings.shapeKind ?? 'circle'}`} style={{ color }}><span /></div>
    case 'frame':
      return <div className={`layer-box studio-frame frame-${layer.settings.frameKind ?? 'chrome'}`} style={{ color }}><span /></div>
    case 'typography':
      return <TypographyLayer layer={layer} />
    case 'audioVisualizer':
      return <AudioVisualizerLayer color={color} kind={String(layer.settings.visualizerKind ?? 'bars')} bars={Number(layer.settings.bars ?? 48)} />
    case 'threeObject':
      return <div className={`layer-box studio-object object-${layer.settings.objectKind ?? 'orb'}`} style={{ color }}><span /><i /></div>
    case 'motionEffect':
      return <div className={`layer-box studio-motion motion-${layer.settings.effectKind ?? 'glitch'}`} style={{ color }}><span /></div>
    case 'puppet':
      return <PuppetCanvasLayer layer={layer} />
    case 'cutout':
      return <div className={`layer-box studio-cutout cutout-${layer.settings.cutoutKind ?? 'upload'}`} style={{ color }}><span /></div>
    case 'subtitle':
      return <SubtitleLayer layer={layer} currentTimeMs={currentTimeMs} />
    default:
      return <div className="image-placeholder">{layer.name}</div>
  }
}

type ParticleLayerProps = {
  color: string
  kind: string
  density: number
}

function ParticleLayer({ color, kind, density }: ParticleLayerProps) {
  const count = Math.max(8, Math.min(96, Math.round(density)))
  return (
    <div className={`layer-box studio-particles particles-${kind}`} style={{ color }}>
      {Array.from({ length: count }).map((_, i) => (
        <b
          key={i}
          style={particleStyle(kind, i)}
        />
      ))}
    </div>
  )
}

function particleStyle(kind: string, i: number): CSSProperties {
  const s = 4 + (i % 6)
  const base: CSSProperties = {
    left: `${(i * 37) % 100}%`,
    top: `${(i * 53) % 100}%`,
    ['--delay' as string]: `${(i % 17) * -0.19}s`,
    ['--s' as string]: `${s}px`,
  }
  if (kind === 'rain') {
    return {
      ...base,
      left: `${(i * 11.3) % 100}%`,
      top: `${-((i * 7) % 40)}%`,
      ['--dur' as string]: `${0.55 + (i % 6) * 0.12}s`,
      ['--delay' as string]: `${-((i % 20) * 0.14)}s`,
      ['--s' as string]: `${2 + (i % 3)}px`,
    }
  }
  if (kind === 'snow') {
    return {
      ...base,
      left: `${(i * 19.7) % 100}%`,
      top: `${-((i * 5) % 30)}%`,
      ['--dur' as string]: `${3.5 + (i % 8) * 0.65}s`,
      ['--delay' as string]: `${-((i % 15) * 0.35)}s`,
      ['--s' as string]: `${3 + (i % 5)}px`,
    }
  }
  if (kind === 'fire') {
    return {
      ...base,
      left: `${18 + ((i * 23) % 64)}%`,
      top: `${55 + ((i * 13) % 38)}%`,
      ['--dur' as string]: `${1.4 + (i % 5) * 0.35}s`,
      ['--delay' as string]: `${-((i % 12) * 0.22)}s`,
      ['--s' as string]: `${5 + (i % 7)}px`,
    }
  }
  if (kind === 'stars') {
    return {
      ...base,
      ['--dur' as string]: `${2.2 + (i % 9) * 0.45}s`,
      ['--s' as string]: `${3 + (i % 4)}px`,
    }
  }
  if (kind === 'smoke' || kind === 'mist') {
    return {
      ...base,
      left: `${(i * 29) % 100}%`,
      top: `${(i * 41) % 100}%`,
      ['--dur' as string]: `${6 + (i % 7) * 1.2}s`,
      ['--s' as string]: `${6 + (i % 5)}px`,
    }
  }
  return {
    ...base,
    animationDelay: `${(i % 17) * -0.19}s`,
  }
}

type AudioVisualizerLayerProps = {
  color: string
  kind: string
  bars: number
}

function AudioVisualizerLayer({ color, kind, bars }: AudioVisualizerLayerProps) {
  const count = Math.max(12, Math.min(96, Math.round(bars)))
  return (
    <div className={`layer-box studio-visualizer visualizer-${kind}`} style={{ color }}>
      {Array.from({ length: count }).map((_, i) => (
        <i
          key={i}
          style={{
            ['--h' as string]: '4%',
            ['--i' as string]: String(Math.round((i / count) * 360)),
          }}
        />
      ))}
    </div>
  )
}

function TypographyLayer({ layer }: { layer: LayerInstance }) {
  const typeKind = String(layer.settings.typeKind ?? 'block')
  const color = String(layer.settings.color ?? '#ffffff')
  return (
    <div className={`studio-type type-${typeKind}`} style={{ color }}>
      {String(layer.settings.text ?? 'AUDIO VISUAL')}
    </div>
  )
}

function TypographyLayerEditing({ layer, onTextChange, onTextCommit }: { layer: LayerInstance; onTextChange?: (layerId: string, text: string) => void; onTextCommit?: (layerId: string, text: string) => void }) {
  const typeKind = String(layer.settings.typeKind ?? 'block')
  const color = String(layer.settings.color ?? '#ffffff')
  const editRef = useRef<HTMLDivElement>(null)
  const initialText = useRef(String(layer.settings.text ?? ''))
  const layerIdRef = useRef(layer.id)
  const onTextCommitRef = useRef(onTextCommit)
  onTextCommitRef.current = onTextCommit

  useEffect(() => {
    const el = editRef.current
    if (!el) return
    el.innerText = initialText.current
    el.focus()
    const range = document.createRange()
    range.selectNodeContents(el)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
  }, [])

  const currentText = () => editRef.current?.innerText ?? initialText.current
  const commit = () => onTextCommit?.(layer.id, currentText())

  useEffect(() => () => {
    onTextCommitRef.current?.(layerIdRef.current, editRef.current?.innerText ?? initialText.current)
  }, [])

  return (
    <div
      ref={editRef}
      className={`studio-type type-${typeKind}`}
      style={{ color, outline: 'none', cursor: 'text', userSelect: 'text' }}
      contentEditable
      suppressContentEditableWarning
      onPointerDown={(e) => e.stopPropagation()}
      onInput={(e) => onTextChange?.(layer.id, e.currentTarget.innerText)}
      onPaste={(e) => {
        e.preventDefault()
        document.execCommand('insertText', false, e.clipboardData.getData('text/plain'))
      }}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Escape' || (e.key === 'Enter' && !e.shiftKey)) { e.preventDefault(); commit() }
      }}
      onBlur={commit}
    />
  )
}
