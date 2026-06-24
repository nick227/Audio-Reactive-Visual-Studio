import { useCallback, useRef, useState } from 'react'
import type { LayerTiming } from '../project/types'
import { DEFAULT_LAYER_TIMING } from '../project/types'
import {
  MOVE_THRESHOLD_PX,
  addGapAt,
  convertAlwaysAt,
  hitTestGap,
  moveGap,
  normalizeGaps,
  removeGap,
  resizeGapEdge,
  trimGapAt,
  xToMs,
  type GapHitZone,
} from '../layers/layerVisibilityTiming'

type Props = {
  durationMs: number
  currentTimeMs: number
  timing?: LayerTiming
  onChange: (timing: LayerTiming) => void
}

type DragMode =
  | { kind: 'move'; gapId: string; pointerStartMs: number }
  | { kind: 'resize'; gapId: string; edge: 'start' | 'end' }
  | { kind: 'click' }

export function LayerVisibilityStrip({ durationMs, currentTimeMs, timing, onChange }: Props) {
  const railRef = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<{ x: number; gapId: string | null; zone: GapHitZone } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [activeGapId, setActiveGapId] = useState<string | null>(null)
  const dragRef = useRef<{
    mode: DragMode
    moved: boolean
    startX: number
    startY: number
    baseGaps: LayerTiming['gaps']
  } | null>(null)

  const resolved = timing ?? DEFAULT_LAYER_TIMING
  const safeDuration = Math.max(durationMs, 1)
  const gaps = resolved.mode === 'gaps' ? normalizeGaps(resolved.gaps, safeDuration) : []
  const showFilled = resolved.mode === 'always'

  const localX = useCallback((clientX: number) => {
    const rail = railRef.current
    if (!rail) return 0
    const rect = rail.getBoundingClientRect()
    return Math.max(0, Math.min(rect.width, clientX - rect.left))
  }, [])

  const emit = useCallback((next: LayerTiming) => onChange(next), [onChange])

  const pointerX = (e: React.PointerEvent) => localX(e.clientX)

  const onPointerMoveHover = (e: React.PointerEvent) => {
    if (dragRef.current) return
    const x = pointerX(e)
    const hit = showFilled
      ? { gap: null as null, zone: 'body' as GapHitZone }
      : hitTestGap(gaps, x, railRef.current?.clientWidth ?? 1, safeDuration)
    setHover({ x, gapId: hit.gap?.id ?? null, zone: showFilled ? 'body' : hit.zone })
  }

  const onPointerLeave = () => {
    if (!dragRef.current) setHover(null)
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || !durationMs) return
    e.stopPropagation()
    e.preventDefault()

    const x = pointerX(e)
    const width = railRef.current?.clientWidth ?? 1
    const hit = showFilled
      ? { gap: null, zone: 'body' as GapHitZone }
      : hitTestGap(gaps, x, width, safeDuration)

    if (hit.gap && (hit.zone === 'start' || hit.zone === 'end')) {
      dragRef.current = {
        mode: { kind: 'resize', gapId: hit.gap.id, edge: hit.zone },
        moved: false,
        startX: e.clientX,
        startY: e.clientY,
        baseGaps: gaps,
      }
      setActiveGapId(hit.gap.id)
    } else if (hit.gap && hit.zone === 'body') {
      const ms = xToMs(x, width, safeDuration)
      dragRef.current = {
        mode: { kind: 'move', gapId: hit.gap.id, pointerStartMs: ms },
        moved: false,
        startX: e.clientX,
        startY: e.clientY,
        baseGaps: gaps,
      }
      setActiveGapId(hit.gap.id)
    } else {
      dragRef.current = {
        mode: { kind: 'click' },
        moved: false,
        startX: e.clientX,
        startY: e.clientY,
        baseGaps: gaps,
      }
    }

    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current
    if (!drag || !durationMs) return

    if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > MOVE_THRESHOLD_PX) {
      drag.moved = true
      setIsDragging(true)
    }
    if (!drag.moved) return

    const x = pointerX(e)
    const width = railRef.current?.clientWidth ?? 1
    const ms = xToMs(x, width, safeDuration)

    if (drag.mode.kind === 'resize') {
      const nextGaps = resizeGapEdge(drag.baseGaps, drag.mode.gapId, drag.mode.edge, ms, safeDuration)
      emit({ mode: 'gaps', gaps: nextGaps })
      return
    }

    if (drag.mode.kind === 'move') {
      const delta = ms - drag.mode.pointerStartMs
      const nextGaps = moveGap(drag.baseGaps, drag.mode.gapId, delta, safeDuration)
      emit({ mode: 'gaps', gaps: nextGaps })
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    const drag = dragRef.current
    dragRef.current = null
    setIsDragging(false)
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* released */ }

    if (!durationMs) return

    const x = pointerX(e)
    const width = railRef.current?.clientWidth ?? 1
    const clickMs = xToMs(x, width, safeDuration)

    if (drag?.moved) {
      setHover(null)
      return
    }

    if (resolved.mode === 'always') {
      emit(convertAlwaysAt(clickMs, safeDuration))
      return
    }

    const hit = hitTestGap(gaps, x, width, safeDuration)
    if (hit.gap && hit.zone === 'body') {
      const nextGaps = trimGapAt(gaps, hit.gap.id, clickMs, safeDuration)
      emit({ mode: 'gaps', gaps: nextGaps })
      setActiveGapId(hit.gap.id)
    }
  }

  const onDoubleClick = (e: React.MouseEvent) => {
    if (!durationMs) return
    e.stopPropagation()
    e.preventDefault()
    dragRef.current = null

    const x = localX(e.clientX)
    const width = railRef.current?.clientWidth ?? 1
    const hit = hitTestGap(gaps, x, width, safeDuration)

    if (resolved.mode === 'always') return

    if (hit.gap) {
      emit(removeGap(gaps, hit.gap.id))
      setActiveGapId(null)
      return
    }

    const clickMs = xToMs(x, width, safeDuration)
    const nextGaps = addGapAt(gaps, clickMs, safeDuration)
    if (nextGaps.length > gaps.length) {
      emit({ mode: 'gaps', gaps: nextGaps })
      setActiveGapId(nextGaps[nextGaps.length - 1]?.id ?? null)
    }
  }

  const playheadPct = `${(currentTimeMs / safeDuration) * 100}%`
  const cutPreviewPct = hover ? `${(hover.x / (railRef.current?.clientWidth ?? 1)) * 100}%` : '0%'
  const cursor = isDragging
    ? 'grabbing'
    : hover?.zone === 'start' || hover?.zone === 'end'
      ? 'ew-resize'
      : hover?.zone === 'body'
        ? 'grab'
        : 'crosshair'

  return (
    <div
      ref={railRef}
      className={`layer-vis-strip${!durationMs ? ' disabled' : ''}${isDragging ? ' dragging' : ''}`}
      style={{ cursor: durationMs ? cursor : 'default' }}
      onPointerDown={onPointerDown}
      onPointerMove={(e) => { onPointerMoveHover(e); onPointerMove(e) }}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      onPointerCancel={onPointerUp}
      onDoubleClick={onDoubleClick}
      onClick={(e) => e.stopPropagation()}
      title={durationMs ? 'Layer visibility timeline' : 'Add audio to edit timing'}
    >
      <div className="layer-vis-rail" />
      {showFilled ? (
        <div className="layer-vis-gap always" style={{ left: 0, width: '100%' }} />
      ) : (
        gaps.map((gap) => {
          const left = `${(gap.startMs / safeDuration) * 100}%`
          const width = `${((gap.endMs - gap.startMs) / safeDuration) * 100}%`
          const hot = activeGapId === gap.id || hover?.gapId === gap.id
          return (
            <div
              key={gap.id}
              className={`layer-vis-gap${hot ? ' hot' : ''}`}
              style={{ left, width }}
            >
              <span className="layer-vis-handle start" />
              <span className="layer-vis-handle end" />
            </div>
          )
        })
      )}
      {hover && hover.zone === 'body' && hover.gapId && !showFilled && (
        <div className="layer-vis-cut-preview" style={{ left: cutPreviewPct }} />
      )}
      {durationMs > 0 && <div className="layer-vis-playhead" style={{ left: playheadPct }} />}
    </div>
  )
}
