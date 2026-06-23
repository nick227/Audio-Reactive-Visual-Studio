import { useCallback, useEffect, useRef, useState } from 'react'
import { AlignLeft, FileText, Loader, Palette, Plus, Trash2, X } from 'lucide-react'
import { parseSrt, displayToMs, msToDisplay, MAX_SRT_CUES } from '../subtitles/parseSrt'
import type { SrtCue } from '../subtitles/parseSrt'
import type { LayerInstance, SubtitleStyle } from '../project/types'

type TabId = 'import' | 'build' | 'style'

type Props = {
  onClose: () => void
  /** Called when saving cues — either creates a new layer or updates existing */
  onSave: (cues: SrtCue[]) => void
  /** Present when editing an existing subtitle layer */
  editingLayer?: LayerInstance | null
  onUpdateLayer?: (patch: Partial<LayerInstance>) => void
  /** Waveform peaks from the main editor (160 values, 0–1) */
  waveformPeaks: number[]
  /** Src URL of the audio track, if loaded */
  audioSrc: string | null
  audioDuration: number
}

// ─── Drag-to-scrub time input ─────────────────────────────────────────────────

function DragTimeInput({
  ms,
  onChangeMs,
  className,
  onFocus,
}: {
  ms: number
  onChangeMs: (ms: number) => void
  className?: string
  onFocus?: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [editVal, setEditVal] = useState('')
  const isDragging = useRef(false)
  const hasMoved = useRef(false)
  const startX = useRef(0)
  const startMs = useRef(ms)

  const commit = (raw: string) => {
    const parsed = displayToMs(raw)
    if (!isNaN(parsed)) onChangeMs(Math.max(0, parsed))
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        autoFocus
        className={className}
        style={{ cursor: 'text' }}
        value={editVal}
        onChange={(e) => setEditVal(e.target.value)}
        onFocus={onFocus}
        onBlur={() => commit(editVal)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); commit(editVal) }
          if (e.key === 'Escape') setEditing(false)
        }}
      />
    )
  }

  return (
    <span
      className={`${className ?? ''} srt-drag-time`}
      onPointerDown={(e) => {
        isDragging.current = true
        hasMoved.current = false
        startX.current = e.clientX
        startMs.current = ms
        e.currentTarget.setPointerCapture(e.pointerId)
        onFocus?.()
      }}
      onPointerMove={(e) => {
        if (!isDragging.current) return
        const dx = e.clientX - startX.current
        if (Math.abs(dx) > 3) hasMoved.current = true
        // 40ms per pixel, snapped to 100ms
        const raw = Math.max(0, startMs.current + dx * 40)
        onChangeMs(Math.round(raw / 100) * 100)
      }}
      onPointerUp={() => { isDragging.current = false }}
      onClick={() => {
        if (hasMoved.current) return
        setEditVal(msToDisplay(ms))
        setEditing(true)
      }}
    >
      {msToDisplay(ms)}
    </span>
  )
}

// ─── Import Tab ───────────────────────────────────────────────────────────────

function ImportTab({ initialCues, onSave, isEditing }: {
  initialCues?: SrtCue[]
  onSave: (cues: SrtCue[]) => void
  isEditing: boolean
}) {
  const [cues, setCues] = useState<SrtCue[] | null>(initialCues ?? null)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [filename, setFilename] = useState<string | null>(initialCues ? 'current cues' : null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = (file: File) => {
    if (!file.name.endsWith('.srt')) { setError('Please select a .srt file.'); return }
    const reader = new FileReader()
    reader.onload = (e) => {
      const raw = e.target?.result as string
      const parsed = parseSrt(raw)
      if (parsed.length === 0) {
        setError('Could not parse this file — no valid cues found.')
        setCues(null)
      } else {
        setCues(parsed)
        setFilename(file.name)
        setError(null)
      }
    }
    reader.readAsText(file)
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const lastCue = cues?.[cues.length - 1]
  const durationLabel = lastCue ? msToDisplay(lastCue.endMs) : null

  return (
    <div className="srt-import-tab">
      <input ref={fileRef} type="file" accept=".srt" hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
      />

      <div
        className={`srt-dropzone${dragging ? ' srt-dropzone--drag' : ''}${cues ? ' srt-dropzone--loaded' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
        role="button" tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
      >
        {cues ? (
          <div className="srt-dropzone-loaded">
            <span className="srt-loaded-icon">✓</span>
            <span className="srt-loaded-name">{filename}</span>
            <span className="srt-loaded-meta">{cues.length} cues · {durationLabel}</span>
            <span className="srt-browse-hint">click to replace</span>
          </div>
        ) : (
          <div className="srt-dropzone-idle">
            <FileText size={32} className="srt-drop-icon" />
            <p>Drop .srt file here</p>
            <span className="srt-browse-hint">or click to browse</span>
          </div>
        )}
      </div>

      {error && <p className="srt-error">{error}</p>}

      {cues && cues.length > 0 && (
        <>
          <div className="srt-preview">
            <p className="srt-preview-label">Preview</p>
            {cues.slice(0, 4).map((cue) => (
              <div key={cue.index} className="srt-preview-row">
                <span className="srt-preview-time">{msToDisplay(cue.startMs)} → {msToDisplay(cue.endMs)}</span>
                <span className="srt-preview-text">{cue.text.replace(/\n/g, ' ')}</span>
              </div>
            ))}
            {cues.length > 4 && <p className="srt-preview-more">…and {cues.length - 4} more cues</p>}
            {cues.length >= MAX_SRT_CUES && <p className="srt-warning">Large file — capped at {MAX_SRT_CUES} cues.</p>}
          </div>

          <div className="srt-tab-actions">
            <button type="button" className="srt-add-btn" onClick={() => onSave(cues)}>
              {isEditing ? 'Update Subtitle Layer' : 'Add Subtitle Layer'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Build Tab ────────────────────────────────────────────────────────────────

type BuildCue = { id: string; startMs: number; endMs: number; text: string }

function newCueAfter(prev?: BuildCue): BuildCue {
  const startMs = prev ? prev.endMs : 0
  return { id: crypto.randomUUID(), startMs, endMs: startMs + 3000, text: '' }
}

function cuesFromSrt(srt: SrtCue[]): BuildCue[] {
  return srt.map((c) => ({ id: crypto.randomUUID(), startMs: c.startMs, endMs: c.endMs, text: c.text }))
}

function BuildTab({
  waveformPeaks, audioSrc, audioDuration, onAutoSave, initialCues,
}: {
  waveformPeaks: number[]
  audioSrc: string | null
  audioDuration: number
  onAutoSave: (cues: SrtCue[]) => void
  initialCues?: SrtCue[]
}) {
  const initBuild = initialCues?.length ? cuesFromSrt(initialCues) : [newCueAfter()]
  const [cues, setCues] = useState<BuildCue[]>(initBuild)
  const [focusedId, setFocusedId] = useState<string>(initBuild[0].id)
  const [currentMs, setCurrentMs] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const animRef = useRef<number | null>(null)
  const textRefs = useRef<Map<string, HTMLInputElement>>(new Map())

  const duration = audioDuration > 0 ? audioDuration : 0
  const progress = duration > 0 ? currentMs / (duration * 1000) : 0

  const syncTime = useCallback(() => {
    const el = audioRef.current
    if (!el) return
    setCurrentMs(el.currentTime * 1000)
    animRef.current = requestAnimationFrame(syncTime)
  }, [])

  const seek = (ratio: number) => {
    const el = audioRef.current
    if (!el || duration === 0) return
    el.currentTime = ratio * duration
    setCurrentMs(ratio * duration * 1000)
  }

  const togglePlay = useCallback(() => {
    const el = audioRef.current
    if (!el) return
    if (el.paused) {
      void el.play(); setIsPlaying(true)
      animRef.current = requestAnimationFrame(syncTime)
    } else {
      el.pause(); setIsPlaying(false)
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [syncTime])

  useEffect(() => () => { if (animRef.current) cancelAnimationFrame(animRef.current) }, [])

  const onAutoSaveRef = useRef(onAutoSave)
  useEffect(() => { onAutoSaveRef.current = onAutoSave }, [onAutoSave])
  const isFirstCueRender = useRef(true)
  useEffect(() => {
    if (isFirstCueRender.current) { isFirstCueRender.current = false; return }
    const valid = cues.filter((c) => c.text.trim()).map((c, i): SrtCue => ({
      index: i + 1, startMs: c.startMs, endMs: Math.max(c.endMs, c.startMs + 100), text: c.text.trim(),
    }))
    if (valid.length === 0) return
    const timer = setTimeout(() => onAutoSaveRef.current(valid), 400)
    return () => clearTimeout(timer)
  }, [cues])

  const markStart = useCallback(() => {
    setCues((prev) => prev.map((c) => c.id === focusedId ? { ...c, startMs: currentMs } : c))
  }, [focusedId, currentMs])

  const markEnd = useCallback(() => {
    setCues((prev) => {
      const idx = prev.findIndex((c) => c.id === focusedId)
      if (idx === -1) return prev
      return prev.map((c, i) => i === idx ? { ...c, endMs: currentMs } : c)
    })
  }, [focusedId, currentMs])

  // Keyboard shortcuts — only when not focused on an input
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as Element
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      if (e.key === '[') { e.preventDefault(); markStart() }
      if (e.key === ']') { e.preventDefault(); markEnd() }
      if (e.key === ' ') { e.preventDefault(); togglePlay() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [markStart, markEnd, togglePlay])

  const addCue = useCallback((afterId?: string) => {
    setCues((prev) => {
      const idx = afterId ? prev.findIndex((c) => c.id === afterId) : prev.length - 1
      const prev_ = prev[idx]
      const next = newCueAfter(prev_)
      const result = [...prev]
      result.splice(idx + 1, 0, next)
      setTimeout(() => {
        setFocusedId(next.id)
        textRefs.current.get(next.id)?.focus()
      }, 0)
      return result
    })
  }, [])

  const removeCue = (id: string) => {
    setCues((prev) => {
      const next = prev.filter((c) => c.id !== id)
      if (next.length === 0) {
        const fresh = newCueAfter()
        setFocusedId(fresh.id)
        return [fresh]
      }
      if (focusedId === id) setFocusedId(next[Math.max(0, prev.findIndex((c) => c.id === id) - 1)].id)
      return next
    })
  }

  const updateCue = (id: string, patch: Partial<BuildCue>) => {
    setCues((prev) => prev.map((c) => c.id === id ? { ...c, ...patch } : c))
  }

  // Enter on text: mark end at currentMs (if playing) and add next cue starting there
  const handleTextEnter = useCallback((cueId: string) => {
    setCues((prev) => {
      const idx = prev.findIndex((c) => c.id === cueId)
      if (idx === -1) return prev
      const endMs = isPlaying ? currentMs : prev[idx].endMs
      const updated = prev.map((c, i) => i === idx ? { ...c, endMs } : c)
      const next = newCueAfter(updated[idx])
      const result = [...updated]
      result.splice(idx + 1, 0, next)
      setTimeout(() => {
        setFocusedId(next.id)
        textRefs.current.get(next.id)?.focus()
      }, 0)
      return result
    })
  }, [isPlaying, currentMs])

  const focusedCue = cues.find((c) => c.id === focusedId)

  return (
    <div className="srt-build-tab">
      {audioSrc && (
        <audio ref={audioRef} src={audioSrc}
          onEnded={() => { setIsPlaying(false); if (animRef.current) cancelAnimationFrame(animRef.current) }}
        />
      )}

      {/* ── Prominent time counter ── */}
      <div className="srt-time-hero">
        <div className="srt-time-hero-clock">{msToDisplay(currentMs)}</div>
        {duration > 0 && (
          <div className="srt-time-hero-total">/ {msToDisplay(duration * 1000)}</div>
        )}
      </div>

      {/* ── Waveform ── */}
      {audioSrc ? (
        <div className="srt-waveform-wrap">
          <div className="srt-waveform" onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            seek((e.clientX - rect.left) / rect.width)
          }}>
            <div className="srt-waveform-bars">
              {waveformPeaks.map((peak, i) => (
                <span key={i} style={{
                  height: `${Math.max(6, peak * 56)}px`,
                  opacity: i / waveformPeaks.length <= progress ? 1 : 0.22,
                }} />
              ))}
            </div>
            {/* Cue tick marks */}
            {duration > 0 && cues.map((c) => (
              <span key={c.id}>
                {c.startMs > 0 && (
                  <i className={`srt-wv-tick srt-wv-tick--start${c.id === focusedId ? ' focused' : ''}`}
                    style={{ left: `${(c.startMs / (duration * 1000)) * 100}%` }} />
                )}
                <i className={`srt-wv-tick srt-wv-tick--end${c.id === focusedId ? ' focused' : ''}`}
                  style={{ left: `${(c.endMs / (duration * 1000)) * 100}%` }} />
              </span>
            ))}
            <i className="srt-playhead" style={{ left: `${progress * 100}%` }} />
          </div>
        </div>
      ) : (
        <div className="srt-no-audio">
          <p>Load an audio track in the editor to enable the waveform scrubber.</p>
        </div>
      )}

      {/* ── Transport ── */}
      <div className="srt-transport">
        <button type="button" className="srt-play-btn" onClick={togglePlay} disabled={!audioSrc}
          aria-label={isPlaying ? 'Pause' : 'Play'}>
          {isPlaying ? '⏸' : '▶'}
        </button>

        <div className="srt-mark-btns">
          <button type="button" className="srt-mark-btn" onClick={markStart} disabled={!audioSrc}
            title="Stamp current time as start of focused cue  ( [ shortcut )">
            [ Mark Start
          </button>
          <button type="button" className="srt-mark-btn" onClick={markEnd} disabled={!audioSrc}
            title="Stamp current time as end of focused cue  ( ] shortcut )">
            Mark End ]
          </button>
        </div>

        {focusedCue && (
          <span className="srt-focused-range">
            {msToDisplay(focusedCue.startMs)} → {msToDisplay(focusedCue.endMs)}
          </span>
        )}
      </div>

      {/* ── Cue list ── */}
      <div className="srt-cue-list">
        <div className="srt-cue-list-header">
          <span>#</span><span>Start</span><span>End</span><span>Text</span><span />
        </div>

        <div className="srt-cue-rows">
          {cues.map((cue, idx) => (
            <div key={cue.id}
              className={`srt-cue-row${cue.id === focusedId ? ' focused' : ''}`}
              onClick={() => setFocusedId(cue.id)}
            >
              <span className="srt-cue-num">{idx + 1}</span>

              <DragTimeInput
                ms={cue.startMs}
                onChangeMs={(v) => updateCue(cue.id, { startMs: v })}
                className="srt-cue-time"
                onFocus={() => setFocusedId(cue.id)}
              />
              <DragTimeInput
                ms={cue.endMs}
                onChangeMs={(v) => updateCue(cue.id, { endMs: v })}
                className="srt-cue-time"
                onFocus={() => setFocusedId(cue.id)}
              />

              <input
                ref={(el) => { el ? textRefs.current.set(cue.id, el) : textRefs.current.delete(cue.id) }}
                className="srt-cue-text"
                placeholder="Type line…"
                value={cue.text}
                onChange={(e) => updateCue(cue.id, { text: e.target.value })}
                onFocus={() => setFocusedId(cue.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); handleTextEnter(cue.id) }
                  if (e.key === 'Backspace' && cue.text === '' && cues.length > 1) {
                    e.preventDefault(); removeCue(cue.id)
                  }
                }}
              />

              <button type="button" className="srt-cue-del"
                onClick={(e) => { e.stopPropagation(); removeCue(cue.id) }}
                aria-label="Delete cue">
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>

      </div>

      <div className="srt-tab-actions">
        <button type="button" className="srt-add-btn" onClick={() => addCue()}>
          <Plus size={13} /> Add New Line
        </button>
      </div>
    </div>
  )
}

// ─── Style Tab ────────────────────────────────────────────────────────────────

const SUBTITLE_STYLES: { id: SubtitleStyle; label: string }[] = [
  { id: 'cinematic', label: 'Cinematic' },
  { id: 'pop',       label: 'Pop'       },
  { id: 'karaoke',   label: 'Karaoke'   },
  { id: 'retro',     label: 'Retro'     },
  { id: 'minimal',   label: 'Minimal'   },
]

const POSITION_DOTS: { label: string; x: number; y: number }[] = [
  { label: 'Top left',    x: -480, y: -800 },
  { label: 'Top center',  x: 0,    y: -800 },
  { label: 'Top right',   x: 480,  y: -800 },
  { label: 'Mid left',    x: -480, y: 0    },
  { label: 'Center',      x: 0,    y: 0    },
  { label: 'Mid right',   x: 480,  y: 0    },
  { label: 'Bot left',    x: -480, y: 700  },
  { label: 'Bot center',  x: 0,    y: 700  },
  { label: 'Bot right',   x: 480,  y: 700  },
]

function StyleTab({ layer, onUpdate }: { layer: LayerInstance; onUpdate: (patch: Partial<LayerInstance>) => void }) {
  const currentStyle = String(layer.settings.subtitleStyle ?? 'cinematic') as SubtitleStyle
  const color = String(layer.settings.color ?? '#ffffff')
  const fontSize = Number(layer.settings.fontSize ?? 48)
  const scale = layer.placement.scale

  return (
    <div className="srt-style-tab">
      {/* Style presets */}
      <section className="srt-style-section">
        <p className="srt-section-label">Preset</p>
        <div className="srt-style-cards">
          {SUBTITLE_STYLES.map((s) => (
            <button key={s.id} type="button"
              className={`srt-style-card subtitle-style-${s.id}${currentStyle === s.id ? ' active' : ''}`}
              onClick={() => onUpdate({ settings: { ...layer.settings, subtitleStyle: s.id } })}
              title={s.label}
            >
              <span className="srt-style-card-preview">Aa</span>
              <span className="srt-style-card-label">{s.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Position */}
      <section className="srt-style-section">
        <p className="srt-section-label">Position</p>
        <div className="srt-pos-grid">
          {POSITION_DOTS.map((dot) => {
            const active = Math.abs(layer.placement.x - dot.x) < 20 && Math.abs(layer.placement.y - dot.y) < 20
            return (
              <button key={dot.label} type="button"
                className={`srt-pos-dot${active ? ' active' : ''}`}
                title={dot.label}
                onClick={() => onUpdate({ placement: { ...layer.placement, fit: 'custom', x: dot.x, y: dot.y } })}
              />
            )
          })}
        </div>
      </section>

      {/* Appearance sliders */}
      <section className="srt-style-section">
        <p className="srt-section-label">Appearance</p>
        <div className="srt-style-sliders">
          <label className="srt-slider-row">
            <span>Text color</span>
            <input type="color" value={color}
              onChange={(e) => onUpdate({ settings: { ...layer.settings, color: e.target.value } })} />
          </label>
          <label className="srt-slider-row">
            <span>Font size <em>{fontSize}px</em></span>
            <input type="range" min={20} max={120} step={2} value={fontSize}
              onChange={(e) => onUpdate({ settings: { ...layer.settings, fontSize: Number(e.target.value) } })} />
          </label>
          <label className="srt-slider-row">
            <span>Container scale <em>{Math.round(scale * 100)}%</em></span>
            <input type="range" min={0.2} max={3} step={0.05} value={scale}
              onChange={(e) => onUpdate({ placement: { ...layer.placement, fit: 'custom', scale: Number(e.target.value) } })} />
          </label>
          <label className="srt-slider-row">
            <span>Opacity <em>{Math.round(layer.placement.opacity * 100)}%</em></span>
            <input type="range" min={0} max={1} step={0.01} value={layer.placement.opacity}
              onChange={(e) => onUpdate({ placement: { ...layer.placement, opacity: Number(e.target.value) } })} />
          </label>
        </div>
      </section>
    </div>
  )
}

// ─── Modal shell ──────────────────────────────────────────────────────────────

const TABS: { id: TabId; label: string; icon: typeof FileText }[] = [
  { id: 'import', label: 'Import SRT', icon: FileText },
  { id: 'build',  label: 'Build',      icon: AlignLeft },
  { id: 'style',  label: 'Style',      icon: Palette },
]

export function SubtitleModal({
  onClose, onSave, editingLayer, onUpdateLayer,
  waveformPeaks, audioSrc, audioDuration,
}: Props) {
  const isEditing = Boolean(editingLayer)
  const initialCues = (editingLayer?.settings.cues ?? []) as SrtCue[]
  // Open on style tab if re-editing, build tab otherwise
  const defaultTab: TabId = isEditing ? 'style' : 'import'
  const [activeTab, setActiveTab] = useState<TabId>(defaultTab)
  const [saving, setSaving] = useState(false)

  const handleSave = (cues: SrtCue[]) => {
    setSaving(true)
    setTimeout(() => {
      onSave(cues)
      setSaving(false)
      onClose()
    }, 60)
  }

  // Style tab updates go straight through to the live layer
  const handleStyleUpdate = (patch: Partial<LayerInstance>) => {
    onUpdateLayer?.(patch)
  }

  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }

  // Cue summary for the style tab header
  const cueCount = initialCues.length
  const lastCue = initialCues[initialCues.length - 1]
  const cueSummary = cueCount > 0
    ? `${cueCount} cues · ${msToDisplay((lastCue?.endMs ?? 0))}`
    : 'No cues loaded'

  return (
    <div className="modal-backdrop" onClick={handleBackdrop}>
      <div className="media-modal srt-modal">
        {/* Header */}
        <div className="fx-browser-tools">
          <div className="modal-tab-strip">
            {TABS.map((tab) => {
              const Icon = tab.icon
              // Hide style tab if no editing layer
              if (tab.id === 'style' && !isEditing) return null
              return (
                <button key={tab.id} type="button"
                  className={`modal-tab-btn${activeTab === tab.id ? ' active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <Icon size={13} />
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* Cue count pill */}
          {isEditing && (
            <span className="srt-modal-summary">{cueSummary}</span>
          )}

          <button type="button" className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="srt-modal-body">
          {saving && (
            <div className="srt-adding-overlay">
              <Loader size={24} className="srt-spinner" />
            </div>
          )}

          {activeTab === 'import' && (
            <ImportTab initialCues={isEditing ? initialCues : undefined} onSave={handleSave} isEditing={isEditing} />
          )}
          {activeTab === 'build' && (
            <BuildTab
              waveformPeaks={waveformPeaks}
              audioSrc={audioSrc}
              audioDuration={audioDuration}
              onAutoSave={onSave}
              initialCues={isEditing ? initialCues : undefined}
            />
          )}
          {activeTab === 'style' && editingLayer && (
            <StyleTab layer={editingLayer} onUpdate={handleStyleUpdate} />
          )}
        </div>
      </div>
    </div>
  )
}
