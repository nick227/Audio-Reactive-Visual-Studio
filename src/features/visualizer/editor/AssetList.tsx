import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, Copy, Eye, EyeOff, RotateCcw, Settings2, Trash2 } from 'lucide-react'
import { assetRegistry } from '../assets/registry'
import type { AssetControl, AudioTrigger, ExtraEffect, FitMode, LayerInstance } from '../project/types'

const triggers: AudioTrigger[] = ['none', 'vocals']
const extras: ExtraEffect[] = ['none', 'float', 'rotate', 'drift', 'shake', 'glow', 'flicker', 'particles']

type PopoverType = 'pulse' | 'scale' | 'settings'
type PopoverState = { id: string; type: PopoverType } | null

type Props = {
  layers: LayerInstance[]
  selectedLayerId: string
  onSelect: (layerId: string) => void
  onUpdate: (layerId: string, patch: Partial<LayerInstance>) => void
  onRemove: (layerId: string) => void
  onMove: (layerId: string, direction: -1 | 1) => void
  onDuplicate: (layerId: string) => void
  onResetPlacement: (layerId: string) => void
  onEditSubtitleLayer?: (layerId: string) => void
}

export function AssetList({
  layers, selectedLayerId, onSelect, onUpdate, onRemove, onMove, onDuplicate,
  onResetPlacement, onEditSubtitleLayer,
}: Props) {
  const [openPopover, setOpenPopover] = useState<PopoverState>(null)

  useEffect(() => {
    if (!openPopover) return
    const handler = (e: MouseEvent) => {
      if (!(e.target as Element).closest('.lr-pop')) setOpenPopover(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [openPopover])

  if (!layers.length) return <p className="layers-empty" />

  return (
    <div className="layer-list">
      {[...layers].reverse().map((layer, reverseIndex) => {
        const actualIndex = layers.length - 1 - reverseIndex
        const template = assetRegistry.get(layer.templateId)
        const active = selectedLayerId === layer.id
        const isSubtitle = String(layer.settings.visualKind) === 'subtitle'
        const hasControls = (template?.controls?.length ?? 0) > 0

        const sp = (e: React.MouseEvent) => e.stopPropagation()
        const toggle = (type: PopoverType) =>
          setOpenPopover(prev => (prev?.id === layer.id && prev.type === type) ? null : { id: layer.id, type })
        const isOpen = (type: PopoverType) => openPopover?.id === layer.id && openPopover.type === type

        return (
          <article
            key={layer.id}
            className={`layer-row${active ? ' active' : ''}${!layer.visible ? ' lr-dim' : ''}`}
            onClick={() => onSelect(layer.id)}
          >
            <span className="layer-name">{layer.name}</span>

            <div className="lr-actions" onClick={sp}>
              {/* Placement group: fit mode + scale */}
              <div className="lr-group" onClick={sp}>
                <select
                  className="lr-select"
                  value={layer.placement.fit}
                  title="Fit mode"
                  onChange={(e) => {
                    const fit = e.target.value as FitMode
                    onUpdate(layer.id, { placement: { ...layer.placement, fit, x: 0, y: 0, scale: 1, rotation: 0 } })
                  }}
                >
                  <option value="contain">Fit</option>
                  <option value="cover">Fill</option>
                  <option value="stretch">Str</option>
                  <option value="custom">Free</option>
                </select>

                <div className="lr-pop" onClick={sp}>
                  <button
                    className={`lr-chip${isOpen('scale') ? ' active' : ''}`}
                    title={`Scale: ${Math.round(layer.placement.scale * 100)}%`}
                    onClick={() => toggle('scale')}
                  >
                    {Math.round(layer.placement.scale * 100)}%
                  </button>
                  {isOpen('scale') && (
                    <div className="lr-vslider-popup">
                      <input
                        type="range" className="lr-vslider"
                        min={0.2} max={2.5} step={0.01}
                        value={layer.placement.scale}
                        onChange={(e) => onUpdate(layer.id, { placement: { ...layer.placement, fit: 'custom', scale: Number(e.target.value) } })}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Reaction group: trigger + pulse */}
              <div className="lr-group" onClick={sp}>
                <select
                  className="lr-select"
                  value={layer.reaction.trigger}
                  title="Audio trigger"
                  onChange={(e) => onUpdate(layer.id, { reaction: { ...layer.reaction, trigger: e.target.value as AudioTrigger } })}
                >
                  {triggers.map(t => <option key={t} value={t}>{triggerLabel(t)}</option>)}
                </select>

                <div className="lr-pop" onClick={sp}>
                  <button
                    className={`lr-chip${isOpen('pulse') ? ' active' : ''}`}
                    title={`Pulse: ${Math.round(layer.reaction.pulseAmount * 100)}%`}
                    onClick={() => toggle('pulse')}
                  >
                    {Math.round(layer.reaction.pulseAmount * 100)}
                  </button>
                  {isOpen('pulse') && (
                    <div className="lr-vslider-popup">
                      <input
                        type="range" className="lr-vslider"
                        min={0} max={0.8} step={0.01}
                        value={layer.reaction.pulseAmount}
                        onChange={(e) => onUpdate(layer.id, { reaction: { ...layer.reaction, pulseAmount: Number(e.target.value) } })}
                      />
                    </div>
                  )}
                </div>

                {/* Settings */}
                {(hasControls || isSubtitle) && (
                  <div className="lr-pop">
                    <button
                      className={`lr-btn${isOpen('settings') ? ' active' : ''}`}
                      title={isSubtitle ? 'Edit subtitle layer' : 'Layer settings'}
                      onClick={() => {
                        if (isSubtitle) {
                          onEditSubtitleLayer?.(layer.id)
                          setOpenPopover(null)
                        } else {
                          toggle('settings')
                        }
                      }}
                    >
                      <Settings2 size={12} />
                    </button>

                    {!isSubtitle && isOpen('settings') && template?.controls && (
                      <div className="lr-settings-popup">
                        {template.controls.map(control => (
                          <AssetControlInput
                            key={control.key}
                            control={control}
                            value={layer.settings[control.key]}
                            onChange={(v) => onUpdate(layer.id, { settings: { ...layer.settings, [control.key]: v } })}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <button className="lr-btn" title={layer.visible ? 'Hide' : 'Show'}
                  onClick={() => onUpdate(layer.id, { visible: !layer.visible })}>
                  {layer.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                </button>
                <button className="lr-btn" title="Delete" onClick={() => onRemove(layer.id)}>
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}

function triggerLabel(t: string) {
  const m: Record<string, string> = { none: 'None', bass: 'Bass', beat: 'Beat', vocals: 'Vox', highs: 'Hi', full: 'Full' }
  return m[t] ?? t
}

// ─── Asset control input ──────────────────────────────────────────────────────

type AssetControlInputProps = { control: AssetControl; value: unknown; onChange: (v: string | number) => void }

function AssetControlInput({ control, value, onChange }: AssetControlInputProps) {
  if (control.type === 'color') {
    return (
      <label className="asset-control-row">
        <span>{control.label}</span>
        <input type="color" value={typeof value === 'string' ? value : '#ffffff'} onChange={e => onChange(e.target.value)} />
      </label>
    )
  }
  if (control.type === 'slider') {
    return (
      <label className="asset-control-row">
        <span>{control.label}</span>
        <input type="range" min={control.min ?? 0} max={control.max ?? 1} step={control.step ?? 0.01}
          value={typeof value === 'number' ? value : Number(control.min ?? 0)}
          onChange={e => onChange(Number(e.target.value))} />
      </label>
    )
  }
  if (control.type === 'select') {
    return (
      <label className="asset-control-row">
        <span>{control.label}</span>
        <select value={String(value ?? '')} onChange={e => onChange(e.target.value)}>
          {(control.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </label>
    )
  }
  return (
    <label className="asset-control-row">
      <span>{control.label}</span>
      <input type="text" value={String(value ?? '')} onChange={e => onChange(e.target.value)} />
    </label>
  )
}
