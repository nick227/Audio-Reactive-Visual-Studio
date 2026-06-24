import { useCallback, useEffect, useRef, useState } from 'react'
import type { LayerTiming } from '../project/types'
import { DEFAULT_LAYER_TIMING } from '../project/types'
import {
  MOVE_THRESHOLD_PX,
  addGapAt,
  convertAlwaysAt,
  copyGapClipboard,
  hitTestGap,
  isDurationKnown,
  moveGap,
  normalizeGaps,
  pasteGapAfter,
  peekGapClipboard,
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
  onDragStart?: () => void
  onChangeTransient: (timing: LayerTiming) => void
  onCommit: (timing: LayerTiming) => void
}

type DragMode =
  | { kind: 'move'; gapId: string; pointerStartMs: number }
  | { kind: 'resize'; gapId: string; edge: 'start' | 'end' }
  | { kind: 'click' }

const FLASH_MS = 650

export function LayerVisibilityStrip({
  durationMs, currentTimeMs, timing, onDragStart, onChangeTransient, onCommit,
}: Props) {
  const railRef = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<{ x: number; gapId: string | null; zone: GapHitZone } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [activeGapId, setActiveGapId] = useState<string | null>(null)
  const [flashAlways, setFlashAlways] = useState(false)
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pasteAnchorMsRef = useRef<number | null>(null)
  const dragRef = useRef<{
    mode: DragMode
    moved: boolean
    startX: number
    startY: number
    baseGaps: LayerTiming['gaps']
    snapshotted: boolean
  } | null>(null)

  const durationReady = isDurationKnown(durationMs)
  const resolved = timing ?? DEFAULT_LAYER_TIMING
  const safeDuration = Math.max(durationMs, 1)
  const gaps = resolved.mode === 'gaps' ? normalizeGaps(resolved.gaps, safeDuration) : []
  const showFilled = !durationReady || resolved.mode === 'always'

  useEffect(() => () => {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
  }, [])

  const pulseAlways = useCallback(() => {
    setFlashAlways(true)
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
    flashTimerRef.current = setTimeout(() => setFlashAlways(false), FLASH_MS)
  }, [])

  const commitRemoveGap = useCallback((gapId: string) => {
    const next = removeGap(gaps, gapId)
    if (next.mode === 'always') pulseAlways()
    onCommit(next)
    setActiveGapId(null)
  }, [gaps, onCommit, pulseAlways])

  useEffect(() => {
    if (activeGapId && !gaps.some((g) => g.id === activeGapId)) {
      setActiveGapId(null)
    }
  }, [activeGapId, gaps])

  const focusStrip = () => railRef.current?.focus()

  const selectGap = useCallback((gapId: string) => {
    setActiveGapId(gapId)
    const gap = gaps.find((g) => g.id === gapId)
    if (gap) pasteAnchorMsRef.current = gap.endMs
  }, [gaps])

  const localX = useCallback((clientX: number) => {
    const rail = railRef.current
    if (!rail) return 0
    const rect = rail.getBoundingClientRect()
    return Math.max(0, Math.min(rect.width, clientX - rect.left))
  }, [])

  const applyTiming = useCallback((next: LayerTiming, transient: boolean) => {
    if (transient) onChangeTransient(next)
    else onCommit(next)
  }, [onChangeTransient, onCommit])

  const pointerX = (e: React.PointerEvent) => localX(e.clientX)

  const onPointerMoveHover = (e: React.PointerEvent) => {
    if (dragRef.current || !durationReady) return
    const x = pointerX(e)
    const hit = showFilled
      ? { gap: null as null, zone: 'body' as GapHitZone }
      : hitTestGap(gaps, x, railRef.current?.clientWidth ?? 1, safeDuration)
    setHover({ x, gapId: hit.gap?.id ?? null, zone: showFilled ? 'body' : hit.zone })
  }

  const onPointerLeave = () => {
    if (!dragRef.current) setHover(null)
  }

  const ensureDragSnapshot = () => {
    const drag = dragRef.current
    if (!drag || drag.snapshotted) return
    onDragStart?.()
    drag.snapshotted = true
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || !durationReady) return
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
        snapshotted: false,
      }
      selectGap(hit.gap.id)
      focusStrip()
    } else if (hit.gap && hit.zone === 'body') {
      const ms = xToMs(x, width, safeDuration)
      dragRef.current = {
        mode: { kind: 'move', gapId: hit.gap.id, pointerStartMs: ms },
        moved: false,
        startX: e.clientX,
        startY: e.clientY,
        baseGaps: gaps,
        snapshotted: false,
      }
      selectGap(hit.gap.id)
      focusStrip()
    } else {
      dragRef.current = {
        mode: { kind: 'click' },
        moved: false,
        startX: e.clientX,
        startY: e.clientY,
        baseGaps: gaps,
        snapshotted: false,
      }
    }

    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current
    if (!drag || !durationReady) return

    if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > MOVE_THRESHOLD_PX) {
      if (!drag.moved && drag.mode.kind !== 'click') {
        ensureDragSnapshot()
      }
      drag.moved = true
      setIsDragging(true)
    }
    if (!drag.moved || drag.mode.kind === 'click') return

    const x = pointerX(e)
    const width = railRef.current?.clientWidth ?? 1
    const ms = xToMs(x, width, safeDuration)

    if (drag.mode.kind === 'resize') {
      const nextGaps = resizeGapEdge(drag.baseGaps, drag.mode.gapId, drag.mode.edge, ms, safeDuration)
      applyTiming({ mode: 'gaps', gaps: nextGaps }, true)
      return
    }

    const delta = ms - drag.mode.pointerStartMs
    const nextGaps = moveGap(drag.baseGaps, drag.mode.gapId, delta, safeDuration)
    applyTiming({ mode: 'gaps', gaps: nextGaps }, true)
  }

  const onPointerUp = (e: React.PointerEvent) => {
    const drag = dragRef.current
    dragRef.current = null
    setIsDragging(false)
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* released */ }

    if (!durationReady) return

    const x = pointerX(e)
    const width = railRef.current?.clientWidth ?? 1
    const clickMs = xToMs(x, width, safeDuration)

    if (drag?.moved) {
      setHover(null)
      focusStrip()
      return
    }

    if (resolved.mode === 'always') {
      onCommit(convertAlwaysAt(clickMs, safeDuration))
      return
    }

    const hit = hitTestGap(gaps, x, width, safeDuration)
    if (hit.gap && hit.zone === 'body') {
      const nextGaps = trimGapAt(gaps, hit.gap.id, clickMs, safeDuration)
      onCommit({ mode: 'gaps', gaps: nextGaps })
      selectGap(hit.gap.id)
      focusStrip()
      return
    }
    if (!hit.gap) setActiveGapId(null)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    const mod = e.metaKey || e.ctrlKey

    if (mod && e.key.toLowerCase() === 'c') {
      if (!activeGapId || showFilled) return
      const gap = gaps.find((g) => g.id === activeGapId)
      if (!gap) return
      e.preventDefault()
      e.stopPropagation()
      copyGapClipboard(gap)
      pasteAnchorMsRef.current = gap.endMs
      return
    }

    if (mod && e.key.toLowerCase() === 'v') {
      const clipboard = peekGapClipboard()
      if (!clipboard || showFilled || !durationReady) return
      const selected = activeGapId ? gaps.find((g) => g.id === activeGapId) : null
      const afterMs = pasteAnchorMsRef.current ?? selected?.endMs
      if (afterMs == null) return
      e.preventDefault()
      e.stopPropagation()
      const result = pasteGapAfter(gaps, afterMs, clipboard.spanMs, safeDuration)
      if (!result.gapId || result.endMs == null) return
      onCommit({ mode: 'gaps', gaps: result.gaps })
      selectGap(result.gapId)
      pasteAnchorMsRef.current = result.endMs
      focusStrip()
      return
    }

    if (e.key !== 'Delete' && e.key !== 'Backspace') return
    if (!activeGapId || showFilled) return
    e.preventDefault()
    e.stopPropagation()
    commitRemoveGap(activeGapId)
  }

  const onDoubleClick = (e: React.MouseEvent) => {
    if (!durationReady) return
    e.stopPropagation()
    e.preventDefault()
    dragRef.current = null

    const x = localX(e.clientX)
    const width = railRef.current?.clientWidth ?? 1
    const hit = hitTestGap(gaps, x, width, safeDuration)

    if (resolved.mode === 'always') return

    if (hit.gap) {
      commitRemoveGap(hit.gap.id)
      return
    }

    const clickMs = xToMs(x, width, safeDuration)
    const nextGaps = addGapAt(gaps, clickMs, safeDuration)
    if (nextGaps.length > gaps.length) {
      onCommit({ mode: 'gaps', gaps: nextGaps })
      const newId = nextGaps[nextGaps.length - 1]?.id
      if (newId) selectGap(newId)
      focusStrip()
    }
  }

  const playheadPct = `${(currentTimeMs / safeDuration) * 100}%`
  const cutPreviewPct = hover ? `${(hover.x / (railRef.current?.clientWidth ?? 1)) * 100}%` : '0%'
  const cursor = !durationReady
    ? 'not-allowed'
    : isDragging
      ? 'grabbing'
      : hover?.zone === 'start' || hover?.zone === 'end'
        ? 'ew-resize'
        : hover?.zone === 'body'
          ? 'grab'
          : 'crosshair'

  return (
    <div
      ref={railRef}
      className={`layer-vis-strip${!durationReady ? ' disabled no-duration' : ''}${isDragging ? ' dragging' : ''}${flashAlways ? ' flash-always' : ''}${activeGapId ? ' has-selection' : ''}`}
      style={{ cursor }}
      tabIndex={durationReady ? 0 : -1}
      role="group"
      aria-label="Layer visibility timeline"
      onPointerDown={onPointerDown}
      onPointerMove={(e) => { onPointerMoveHover(e); onPointerMove(e) }}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      onPointerCancel={onPointerUp}
      onDoubleClick={onDoubleClick}
      onKeyDown={onKeyDown}
      onClick={(e) => e.stopPropagation()}
      title={durationReady ? 'Layer visibility — Delete removes section, Ctrl+C/V duplicates' : 'Add audio to edit timing — layer stays fully visible'}
    >
      <div className="layer-vis-rail" />
      {showFilled ? (
        <div className={`layer-vis-gap always${!durationReady ? ' pending' : ''}`} style={{ left: 0, width: '100%' }} />
      ) : (
        gaps.map((gap) => {
          const left = `${(gap.startMs / safeDuration) * 100}%`
          const width = `${((gap.endMs - gap.startMs) / safeDuration) * 100}%`
          const hot = activeGapId === gap.id || hover?.gapId === gap.id
          return (
            <div
              key={gap.id}
              className={`layer-vis-gap${hot ? ' hot' : ''}${activeGapId === gap.id ? ' selected' : ''}`}
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
      {durationReady && <div className="layer-vis-playhead" style={{ left: playheadPct }} />}
    </div>
  )
}
