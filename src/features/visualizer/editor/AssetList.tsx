import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Eye, EyeOff, Settings2, Trash2 } from 'lucide-react'
import { assetRegistry } from '../assets/registry'
import type { AssetControl, AudioTrigger, FitMode, LayerInstance } from '../project/types'
import { LayerVisibilityStrip } from './LayerVisibilityStrip'

const triggers: AudioTrigger[] = ['none', 'bass', 'beat', 'vocals', 'highs', 'full']

type Props = {
  layers: LayerInstance[]
  selectedLayerId: string
  durationMs: number
  currentTimeMs: number
  onSelect: (layerId: string) => void
  onUpdate: (layerId: string, patch: Partial<LayerInstance>) => void
  onUpdateTransient: (layerId: string, patch: Partial<LayerInstance>) => void
  onTimingDragStart: () => void
  onRemove: (layerId: string) => void
  onReorder: (layers: LayerInstance[]) => void
  onEditSubtitleLayer?: (layerId: string) => void
  onEditVideoLayer?: (layerId: string) => void
}

export function AssetList({
  layers, selectedLayerId, durationMs, currentTimeMs, onSelect, onUpdate, onUpdateTransient,
  onTimingDragStart, onRemove, onReorder, onEditSubtitleLayer, onEditVideoLayer,
}: Props) {
  const [settingsLayerId, setSettingsLayerId] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const dragRef = useRef<{ id: string; moved: boolean; startX: number } | null>(null)
  const suppressClickRef = useRef(false)

  const displayLayers = useMemo(() => [...layers].reverse(), [layers])

  useEffect(() => {
    if (!settingsLayerId) return
    const handler = (e: MouseEvent) => {
      if (!(e.target as Element).closest('.lr-pop')) setSettingsLayerId(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [settingsLayerId])

  const reorderById = useCallback((fromId: string, toId: string) => {
    if (fromId === toId) return
    const fromIdx = displayLayers.findIndex((l) => l.id === fromId)
    const toIdx = displayLayers.findIndex((l) => l.id === toId)
    if (fromIdx < 0 || toIdx < 0) return
    const next = [...displayLayers]
    const [item] = next.splice(fromIdx, 1)
    next.splice(toIdx, 0, item)
    onReorder([...next].reverse())
  }, [displayLayers, onReorder])

  const onDragStart = (layerId: string) => (e: React.PointerEvent) => {
    if (e.button !== 0) return
    e.stopPropagation()
    dragRef.current = { id: layerId, moved: false, startX: e.clientX }
    setDraggingId(layerId)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onDragMove = (e: React.PointerEvent) => {
    const drag = dragRef.current
    if (!drag) return
    if (Math.abs(e.clientX - drag.startX) > 4) drag.moved = true
    const el = document.elementFromPoint(e.clientX, e.clientY)
    const row = el?.closest<HTMLElement>('[data-layer-id]')
    setDragOverId(row?.dataset.layerId ?? null)
  }

  const onDragEnd = (e: React.PointerEvent) => {
    const drag = dragRef.current
    const fromId = drag?.id
    const didMove = drag?.moved ?? false
    dragRef.current = null
    setDraggingId(null)
    setDragOverId(null)
    if (didMove) {
      suppressClickRef.current = true
      if (fromId) {
        const row = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-layer-id]')
        const toId = row?.dataset.layerId
        if (toId && toId !== fromId) reorderById(fromId, toId)
      }
    }
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* released */ }
  }

  if (!layers.length) return <p className="layers-empty" />

  return (
    <div className="layer-list">
      {displayLayers.map((layer) => {
        const template = assetRegistry.get(layer.templateId)
        const active = selectedLayerId === layer.id
        const isSubtitle = String(layer.settings.visualKind) === 'subtitle'
        const isVideo = layer.templateId === 'video-layer'
        const settingsOpen = settingsLayerId === layer.id
        const isDragging = draggingId === layer.id
        const isDragOver = dragOverId === layer.id && draggingId !== layer.id

        const sp = (e: React.MouseEvent) => e.stopPropagation()

        return (
          <article
            key={layer.id}
            data-layer-id={layer.id}
            className={`layer-row${active ? ' active' : ''}${!layer.visible ? ' lr-dim' : ''}${isDragging ? ' dragging' : ''}${isDragOver ? ' drag-over' : ''}`}
            onClick={() => {
              if (suppressClickRef.current) {
                suppressClickRef.current = false
                return
              }
              onSelect(layer.id)
            }}
          >
            <span
              className="layer-name layer-drag-handle"
              onPointerDown={onDragStart(layer.id)}
              onPointerMove={onDragMove}
              onPointerUp={onDragEnd}
              onPointerCancel={onDragEnd}
            >
              {layer.name}
            </span>

            <LayerVisibilityStrip
              durationMs={durationMs}
              currentTimeMs={currentTimeMs}
              timing={layer.timing}
              onDragStart={onTimingDragStart}
              onChangeTransient={(timing) => onUpdateTransient(layer.id, { timing })}
              onCommit={(timing) => onUpdate(layer.id, { timing })}
            />

            <button
              type="button"
              className="lr-btn lr-eye-btn"
              title={layer.visible ? 'Hide layer' : 'Show layer'}
              onClick={(e) => { e.stopPropagation(); onUpdate(layer.id, { visible: !layer.visible }) }}
            >
              {layer.visible ? <Eye size={12} /> : <EyeOff size={12} />}
            </button>

            <div className="lr-pop" onClick={sp}>
              <button
                type="button"
                className={`lr-btn${settingsOpen ? ' active' : ''}`}
                title="Layer settings"
                onClick={() => setSettingsLayerId(settingsOpen ? null : layer.id)}
              >
                <Settings2 size={12} />
              </button>

              {settingsOpen && (
                <LayerSettingsPopup
                  layer={layer}
                  isSubtitle={isSubtitle}
                  isVideo={isVideo}
                  templateControls={template?.controls}
                  onUpdate={(patch) => onUpdate(layer.id, patch)}
                  onRemove={() => { onRemove(layer.id); setSettingsLayerId(null) }}
                  onEditSubtitle={() => { onEditSubtitleLayer?.(layer.id); setSettingsLayerId(null) }}
                  onEditVideo={() => { onEditVideoLayer?.(layer.id); setSettingsLayerId(null) }}
                />
              )}
            </div>
          </article>
        )
      })}
    </div>
  )
}

type LayerSettingsPopupProps = {
  layer: LayerInstance
  isSubtitle: boolean
  isVideo: boolean
  templateControls?: AssetControl[]
  onUpdate: (patch: Partial<LayerInstance>) => void
  onRemove: () => void
  onEditSubtitle: () => void
  onEditVideo: () => void
}

function LayerSettingsPopup({
  layer, isSubtitle, isVideo, templateControls, onUpdate, onRemove, onEditSubtitle, onEditVideo,
}: LayerSettingsPopupProps) {
  const sp = (e: React.MouseEvent) => e.stopPropagation()

  return (
    <div className="lr-settings-popup" onClick={sp}>
      {isSubtitle && (
        <button type="button" className="lr-settings-link" onClick={onEditSubtitle}>
          Edit subtitles…
        </button>
      )}
      {isVideo && (
        <button type="button" className="lr-settings-link" onClick={onEditVideo}>
          Video Settings…
        </button>
      )}

      <label className="lr-settings-field">
        <span>Fit</span>
        <select
          className="lr-settings-select"
          value={layer.placement.fit}
          onChange={(e) => {
            const fit = e.target.value as FitMode
            onUpdate({ placement: { ...layer.placement, fit, x: 0, y: 0, scale: 1, rotation: 0 } })
          }}
        >
          <option value="contain">Fit</option>
          <option value="cover">Fill</option>
          <option value="stretch">Stretch</option>
          <option value="custom">Free</option>
        </select>
      </label>

      <label className="lr-settings-field">
        <span>Scale <em>{Math.round(layer.placement.scale * 100)}%</em></span>
        <input
          type="range" min={0.2} max={2.5} step={0.01}
          value={layer.placement.scale}
          onChange={(e) => onUpdate({ placement: { ...layer.placement, fit: 'custom', scale: Number(e.target.value) } })}
        />
      </label>

      <label className="lr-settings-field">
        <span>Trigger</span>
        <select
          className="lr-settings-select"
          value={layer.reaction.trigger}
          onChange={(e) => onUpdate({ reaction: { ...layer.reaction, trigger: e.target.value as AudioTrigger } })}
        >
          {triggers.map((t) => <option key={t} value={t}>{triggerLabel(t)}</option>)}
        </select>
      </label>

      <label className="lr-settings-field">
        <span>Pulse <em>{Math.round(layer.reaction.pulseAmount * 100)}%</em></span>
        <input
          type="range" min={0} max={0.8} step={0.01}
          value={layer.reaction.pulseAmount}
          onChange={(e) => onUpdate({ reaction: { ...layer.reaction, pulseAmount: Number(e.target.value) } })}
        />
      </label>

      {templateControls?.map((control) => (
        <AssetControlInput
          key={control.key}
          control={control}
          value={layer.settings[control.key]}
          onChange={(v) => onUpdate({ settings: { [control.key]: v } })}
        />
      ))}

      <div className="lr-settings-footer">
        <button
          type="button"
          className="lr-settings-icon-btn"
          title={layer.visible ? 'Hide layer' : 'Show layer'}
          onClick={() => onUpdate({ visible: !layer.visible })}
        >
          {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
        <button type="button" className="lr-settings-icon-btn danger" title="Delete layer" onClick={onRemove}>
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}

function triggerLabel(t: string) {
  const m: Record<string, string> = { none: 'None', bass: 'Bass', beat: 'Beat', vocals: 'Vox', highs: 'Hi', full: 'Full' }
  return m[t] ?? t
}

function normalizeColorValue(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('#')) return '#ffffff'
  if (value.length === 4) {
    const [, r, g, b] = value
    return `#${r}${r}${g}${g}${b}${b}`
  }
  if (value.length === 7) return value
  return '#ffffff'
}

type AssetControlInputProps = { control: AssetControl; value: unknown; onChange: (v: string | number) => void }

function AssetControlInput({ control, value, onChange }: AssetControlInputProps) {
  if (control.type === 'color') {
    const hex = normalizeColorValue(value)
    return (
      <label className="lr-settings-field">
        <span>{control.label}</span>
        <input
          type="color"
          value={hex}
          onInput={(e) => onChange(e.currentTarget.value)}
          onChange={(e) => onChange(e.currentTarget.value)}
        />
      </label>
    )
  }
  if (control.type === 'slider') {
    return (
      <label className="lr-settings-field">
        <span>{control.label}</span>
        <input
          type="range" min={control.min ?? 0} max={control.max ?? 1} step={control.step ?? 0.01}
          value={typeof value === 'number' ? value : Number(control.min ?? 0)}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </label>
    )
  }
  if (control.type === 'select') {
    return (
      <label className="lr-settings-field">
        <span>{control.label}</span>
        <select className="lr-settings-select" value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
          {(control.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </label>
    )
  }
  return (
    <label className="lr-settings-field">
      <span>{control.label}</span>
      <input className="lr-settings-input" type="text" value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}
