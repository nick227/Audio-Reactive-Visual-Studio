import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
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
import { puppetRuntimeHost } from '../runtime/puppetRuntimeHost'

export type StageHandle = {
  updateFrame: (features: AudioFeatures, time: number) => void
  getStageElement: () => HTMLDivElement | null
}

type Props = {
  project: Project
  selectedLayerId: string
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
  { project, selectedLayerId, onSelectLayer, onUpdateLayer, onDragStart, onDoubleClickLayer, editingLayerId, onTextChange, onTextCommit, currentTimeMs = 0 },
  ref,
) {
  const layerRefs = useRef(new Map<string, HTMLDivElement>())
  const stageElRef = useRef<HTMLDivElement>(null)
  const projectRef = useRef(project)
  projectRef.current = project
  const smoothedValuesRef = useRef(new Map<string, number>())
  const microEventEngineRef = useRef(new MicroEventEngine())
  const stageRatio = `${project.stage.width} / ${project.stage.height}`

  useImperativeHandle(ref, () => ({
    getStageElement: () => stageElRef.current,
    updateFrame(features, time) {
      const current = projectRef.current
      puppetRuntimeHost.setFeatures(features)
      const activeEffects = microEventEngineRef.current.tick(features, time, current.microEvents ?? [])

      for (const layer of current.layers) {
        const el = layerRefs.current.get(layer.id)
        if (el) {
          const raw = audioValue(features, layer.reaction.trigger)
          const prev = smoothedValuesRef.current.get(layer.id) ?? raw
          const smoothed = prev * layer.reaction.smoothness + raw * (1 - layer.reaction.smoothness)
          smoothedValuesRef.current.set(layer.id, smoothed)

          const microEffect = layer.role ? activeEffects.get(layer.role) : undefined
          applyLayerFrame(el, layer, features, smoothed, time, current.stage, microEffect)

          // Per-bar audio update for audioVisualizer layers
          if (features.bins) {
            const visualKind = String(layer.settings.visualKind ?? fallbackKind(layer.templateId))
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
              onTextChange={onTextChange}
              onTextCommit={onTextCommit}
              currentTimeMs={currentTimeMs}
            />
          </LayerErrorBoundary>
        ))}
      </div>
    </div>
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
  onTextChange?: (layerId: string, text: string) => void
  onTextCommit?: (layerId: string, text: string) => void
  currentTimeMs: number
}

const StageLayer = memo(function StageLayer({ layer, selected, stageWidth, stageHeight, setRef, onSelectLayer, onUpdateLayer, onDragStart, onDoubleClick, isEditing, onTextChange, onTextCommit, currentTimeMs }: LayerProps) {
  const template = assetRegistry.get(layer.templateId)
  const hostRef = useRef<HTMLDivElement | null>(null)
  const initialTransform = computeLayerTransform(layer, silentAudioFeatures, 0)
  const stageSize = useMemo(() => ({ width: stageWidth, height: stageHeight }), [stageHeight, stageWidth])
  const style = layerHostStyle(layer, initialTransform, stageSize)
  const content = useMemo(
    () => isEditing ? null : renderLayerContent(layer, currentTimeMs),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [layer.id, layer.templateId, layer.settings, layer.name, layer.placement.fit, isEditing, currentTimeMs],
  )

  if (!template) return null

  const isSubtitle = String(layer.settings.visualKind) === 'subtitle'
  const counterScale = 1 / Math.max(0.01, layer.placement.scale)

  const handleResizeStart = (e: React.PointerEvent<HTMLDivElement>, cursor: string) => {
    if (layer.locked) return
    e.stopPropagation()
    onSelectLayer(layer.id)
    onDragStart?.()

    const stageEl = e.currentTarget.closest<HTMLElement>('.stage')
    const stageBounds = stageEl?.getBoundingClientRect()
    if (!stageBounds) return

    // Build the move handler; early-return before committing to capture/drag.
    let move = (_e: PointerEvent) => {}

    if (isSubtitle) {
      // Subtitle resize: scale fontSize relative to subtitle text's screen position.
      const offsetY = Number(layer.settings.subtitleOffsetY ?? 10)
      const centerX = stageBounds.left + stageBounds.width * 0.5
      const centerY = stageBounds.top + stageBounds.height * (1 - offsetY / 100)
      const startDist = Math.hypot(e.clientX - centerX, e.clientY - centerY)
      if (startDist < 5) return
      const startFontSize = Number(layer.settings.fontSize ?? 48)
      move = (me: PointerEvent) => {
        const newDist = Math.hypot(me.clientX - centerX, me.clientY - centerY)
        onUpdateLayer(layer.id, {
          settings: { fontSize: Math.max(8, Math.round(startFontSize * (newDist / startDist))) },
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
    onDragStart?.()

    const el = event.currentTarget
    const stageEl = el.closest<HTMLElement>('.stage')
    const stageBounds = stageEl?.getBoundingClientRect()
    if (!stageBounds) return

    document.body.style.userSelect = 'none'
    el.setPointerCapture(event.pointerId)

    // Shared cleanup — `move` is assigned below before listeners are added.
    let move = (_e: PointerEvent) => {}
    const cleanup = () => {
      document.body.style.userSelect = ''
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', cleanup)
      window.removeEventListener('pointercancel', cleanup)
    }

    if (isSubtitle) {
      // Subtitle: drag up/down to reposition via subtitleOffsetY (% from bottom).
      const startOffsetY = Number(layer.settings.subtitleOffsetY ?? 10)
      const startClientY = event.clientY
      const stageDisplayH = stageBounds.height
      move = (me: PointerEvent) => {
        const deltaYPct = ((me.clientY - startClientY) / stageDisplayH) * 100
        onUpdateLayer(layer.id, {
          settings: { subtitleOffsetY: Math.max(2, Math.min(95, startOffsetY - deltaYPct)) },
        })
      }
    } else {
      // Normal layer: drag to reposition in stage coordinates.
      const scaleX = stageBounds.width ? stageWidth / stageBounds.width : 1
      const scaleY = stageBounds.height ? stageHeight / stageBounds.height : 1
      const startClientX = event.clientX
      const startClientY = event.clientY
      const originX = layer.placement.x
      const originY = layer.placement.y
      move = (me: PointerEvent) => {
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
      className={`stage-layer ${selected ? 'selected' : ''}${isSubtitle ? ' subtitle-host' : ''}`}
      style={style}
      onPointerDown={onPointerDown}
      onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick?.(layer.id) }}
    >
      {isEditing ? <TypographyLayerEditing layer={layer} onTextChange={onTextChange} onTextCommit={onTextCommit} /> : content}
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
                style={{ bottom: `${Number(layer.settings.subtitleOffsetY ?? 10)}%` }}
                onPointerDown={(e) => handleResizeStart(e, 'ew-resize')}
              />
              <div
                className="resize-handle resize-handle-sub-r"
                style={{ bottom: `${Number(layer.settings.subtitleOffsetY ?? 10)}%` }}
                onPointerDown={(e) => handleResizeStart(e, 'ew-resize')}
              />
            </>
          )}
        </div>
      )}
    </div>
  )
})

function renderLayerContent(layer: LayerInstance, currentTimeMs: number = 0) {
  const visualKind = String(layer.settings.visualKind ?? fallbackKind(layer.templateId))
  const color = String(layer.settings.color ?? '#ffffff')

  if (layer.templateId === 'photo-cutout') {
    return layer.settings.src ? <img className="image-layer" src={String(layer.settings.src)} alt={layer.name} draggable={false} /> : <div className="image-placeholder">Upload<br />Image</div>
  }
  if (layer.templateId === 'video-layer') {
    return layer.settings.src ? <video className="video-layer" src={String(layer.settings.src)} autoPlay loop muted playsInline /> : <div className="image-placeholder">Upload<br />Video</div>
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

function fallbackKind(templateId: string) {
  switch (templateId) {
    case 'liquid-gradient': return 'gradient'
    case 'bass-rings': return 'audioVisualizer'
    case 'spark-particles': return 'particles'
    case 'chrome-frame': return 'frame'
    case 'kinetic-title': return 'typography'
    case 'vhs-noise': return 'texture'
    case 'puppet-dancer':
    case 'puppet-street':
    case 'puppet-evening':
    case 'puppet-blazer':
    case 'puppet-stage':
    case 'puppet-robot':
      return 'puppet'
    default: return 'unknown'
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
          style={{
            left: `${(i * 37) % 100}%`,
            top: `${(i * 53) % 100}%`,
            animationDelay: `${(i % 17) * -0.19}s`,
            ['--s' as string]: `${4 + (i % 6)}px`,
          }}
        />
      ))}
    </div>
  )
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
  return (
    <div className={`studio-type type-${typeKind}`} style={{ color: String(layer.settings.color ?? '#ffffff') }}>
      {String(layer.settings.text ?? 'AUDIO VISUAL')}
    </div>
  )
}

function TypographyLayerEditing({ layer, onTextChange, onTextCommit }: { layer: LayerInstance; onTextChange?: (layerId: string, text: string) => void; onTextCommit?: (layerId: string, text: string) => void }) {
  const typeKind = String(layer.settings.typeKind ?? 'block')
  const color = String(layer.settings.color ?? '#ffffff')
  const editRef = useRef<HTMLDivElement>(null)
  const initialText = useRef(String(layer.settings.text ?? ''))

  useEffect(() => {
    const el = editRef.current
    if (!el) return
    el.focus()
    const range = document.createRange()
    range.selectNodeContents(el)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
  }, [])

  const currentText = () => editRef.current?.innerText ?? initialText.current
  const commit = () => onTextCommit?.(layer.id, currentText())

  return (
    <div
      ref={editRef}
      className={`studio-type type-${typeKind}`}
      style={{ color, outline: 'none', cursor: 'text', userSelect: 'text' }}
      contentEditable
      suppressContentEditableWarning
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: initialText.current }}
      onPointerDown={(e) => e.stopPropagation()}
      onInput={(e) => onTextChange?.(layer.id, e.currentTarget.innerText)}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Escape' || (e.key === 'Enter' && !e.shiftKey)) { e.preventDefault(); commit() }
      }}
      onBlur={commit}
    />
  )
}
