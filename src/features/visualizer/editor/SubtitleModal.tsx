import { useCallback, useEffect, useRef, useState } from 'react'
import { AlignLeft, FileText, Loader, Mic2, Palette, Plus, Trash2, Wand2, X } from 'lucide-react'
import { parseSrt, displayToMs, msToDisplay, formatSrt, MAX_SRT_CUES } from '../subtitles/parseSrt'
import type { SrtCue } from '../subtitles/parseSrt'
import { lyricsToSrt } from '../subtitles/lyricsToSrt'
import type { LayerInstance, SubtitleStyle } from '../project/types'

type TabId = 'lyrics' | 'import' | 'build' | 'style'

type Props = {
  onClose: () => void
  /** Called when saving cues to the layer */
  onSave: (cues: SrtCue[]) => void
  editingLayer: LayerInstance
  onUpdateLayer: (patch: Partial<LayerInstance>) => void
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

// ─── Lyrics Tab ───────────────────────────────────────────────────────────────

function LyricsTab({
  cues,
  audioDuration,
  onCuesChange,
  onSave,
}: {
  cues: SrtCue[]
  audioDuration: number
  onCuesChange: (cues: SrtCue[]) => void
  onSave: (cues: SrtCue[]) => void
}) {
  const [raw, setRaw] = useState(() => (cues.length ? formatSrt(cues) : ''))
  const [converted, setConverted] = useState<SrtCue[] | null>(cues.length ? cues : null)
  const [error, setError] = useState<string | null>(null)

  const durationMs = audioDuration > 0 ? audioDuration * 1000 : 0
  const durationHint = durationMs > 0
    ? `Timing will be fit to your track (${msToDisplay(durationMs)}).`
    : 'No audio loaded — timing will be estimated from text length (~spoken-word pace).'

  const activeCues = converted ?? (cues.length ? cues : null)

  const handleConvert = () => {
    const trimmed = raw.trim()
    if (!trimmed) {
      setError('Paste or type your lyrics first.')
      setConverted(null)
      return
    }

    const fromSrt = trimmed.includes('-->') ? parseSrt(trimmed) : []
    const result = fromSrt.length > 0
      ? fromSrt
      : lyricsToSrt(trimmed, { durationMs })

    if (result.length === 0) {
      setError('Could not split text into lines.')
      setConverted(null)
      return
    }

    onCuesChange(result)
    setConverted(result)
    setRaw(formatSrt(result))
    setError(null)
  }

  const lastCue = activeCues?.[activeCues.length - 1]
  const spanLabel = lastCue ? msToDisplay(lastCue.endMs) : null

  return (
    <div className="srt-lyrics-tab">
      <p className="srt-lyrics-hint">
        {activeCues
          ? `Loaded subtitles shown as SRT below · ${spanLabel ?? ''}`
          : durationHint}
      </p>

      <textarea
        className="srt-lyrics-input srt-source-input"
        placeholder={'Paste or type lyrics…\n\nOne line per subtitle, or separate stanzas with a blank line.'}
        value={raw}
        onChange={(e) => { setRaw(e.target.value); setConverted(null); setError(null) }}
        rows={12}
        spellCheck={false}
      />

      <div className="srt-lyrics-actions">
        <button type="button" className="srt-convert-btn" onClick={handleConvert} disabled={!raw.trim()}>
          <Wand2 size={13} /> Convert
        </button>
      </div>

      {error && <p className="srt-error">{error}</p>}

      {activeCues && activeCues.length > 0 && (
        <div className="srt-tab-actions">
          <button type="button" className="srt-add-btn" onClick={() => onSave(activeCues)}>
            Apply &amp; Close
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Import Tab ───────────────────────────────────────────────────────────────

function cuesEqual(a: SrtCue[], b: SrtCue[]): boolean {
  if (a.length !== b.length) return false
  return a.every((c, i) =>
    c.startMs === b[i].startMs && c.endMs === b[i].endMs && c.text === b[i].text,
  )
}

// ─── Import Tab ───────────────────────────────────────────────────────────────

function ImportTab({ cues, savedCues, onCuesChange, onSave }: {
  cues: SrtCue[]
  savedCues: SrtCue[]
  onCuesChange: (cues: SrtCue[]) => void
  onSave: (cues: SrtCue[]) => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [filename, setFilename] = useState<string | null>(cues.length ? 'current cues' : null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = (file: File) => {
    if (!file.name.endsWith('.srt')) { setError('Please select a .srt file.'); return }
    const reader = new FileReader()
    reader.onload = (e) => {
      const raw = e.target?.result as string
      const parsed = parseSrt(raw)
      if (parsed.length === 0) {
        setError('Could not parse this file — no valid cues found.')
        onCuesChange([])
      } else {
        onCuesChange(parsed)
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

  const lastCue = cues[cues.length - 1]
  const durationLabel = lastCue ? msToDisplay(lastCue.endMs) : null
  const importPending = cues.length > 0 && !cuesEqual(cues, savedCues)

  return (
    <div className="srt-import-tab">
      <input ref={fileRef} type="file" accept=".srt" hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
      />

      <div
        className={`srt-dropzone${dragging ? ' srt-dropzone--drag' : ''}${cues.length ? ' srt-dropzone--loaded' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
        role="button" tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
      >
        {cues.length > 0 ? (
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

      {cues.length >= MAX_SRT_CUES && (
        <p className="srt-warning">Large file — capped at {MAX_SRT_CUES} cues.</p>
      )}

      {importPending && (
        <div className="srt-tab-actions">
          <button type="button" className="srt-add-btn" onClick={() => onSave(cues)}>
            Apply Subtitles
          </button>
        </div>
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

function buildCuesToSrt(cues: BuildCue[]): SrtCue[] {
  return cues
    .filter((c) => c.text.trim())
    .map((c, i) => ({
      index: i + 1,
      startMs: c.startMs,
      endMs: Math.max(c.endMs, c.startMs + 100),
      text: c.text.trim(),
    }))
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
    const valid = buildCuesToSrt(cues)
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

type SubtitlePosition = 'bottom' | 'middle' | 'top'

const SUBTITLE_POSITIONS: { id: SubtitlePosition; label: string; offsetY: number }[] = [
  { id: 'bottom', label: 'Bottom', offsetY: 10 },
  { id: 'middle', label: 'Middle', offsetY: 50 },
  { id: 'top', label: 'Top', offsetY: 85 },
]

function offsetToPosition(offsetY: number): SubtitlePosition {
  if (offsetY >= 65) return 'top'
  if (offsetY >= 30) return 'middle'
  return 'bottom'
}

function StyleTab({ layer, onUpdate }: { layer: LayerInstance; onUpdate: (patch: Partial<LayerInstance>) => void }) {
  const currentStyle = String(layer.settings.subtitleStyle ?? 'cinematic') as SubtitleStyle
  const color = String(layer.settings.color ?? '#ffffff')
  const fontSize = Number(layer.settings.fontSize ?? 48)
  const scale = layer.placement.scale
  const offsetY = Number(layer.settings.subtitleOffsetY ?? 10)
  const position = offsetToPosition(offsetY)

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

      {/* Appearance */}
      <section className="srt-style-section">
        <p className="srt-section-label">Appearance</p>
        <div className="srt-style-sliders">
          <label className="srt-slider-row">
            <span>Position</span>
            <select
              className="srt-select"
              value={position}
              onChange={(e) => {
                const next = SUBTITLE_POSITIONS.find((p) => p.id === e.target.value)
                if (next) onUpdate({ settings: { ...layer.settings, subtitleOffsetY: next.offsetY } })
              }}
            >
              {SUBTITLE_POSITIONS.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </label>
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
        </div>
      </section>
    </div>
  )
}

// ─── Modal shell ──────────────────────────────────────────────────────────────

const TABS: { id: TabId; label: string; icon: typeof FileText }[] = [
  { id: 'lyrics', label: 'Lyrics',     icon: Mic2     },
  { id: 'import', label: 'SRT', icon: FileText },
  { id: 'build',  label: 'Build',      icon: AlignLeft },
  { id: 'style',  label: 'Style',      icon: Palette  },
]

export function SubtitleModal({
  onClose, onSave, editingLayer, onUpdateLayer,
  waveformPeaks, audioSrc, audioDuration,
}: Props) {
  const initialCues = (editingLayer.settings.cues ?? []) as SrtCue[]
  const defaultTab: TabId = initialCues.length > 0 ? 'build' : 'lyrics'
  const [activeTab, setActiveTab] = useState<TabId>(defaultTab)
  const [saving, setSaving] = useState(false)
  const [cues, setCues] = useState<SrtCue[]>(initialCues)
  const [savedCues, setSavedCues] = useState<SrtCue[]>(initialCues)

  const handleCuesChange = useCallback((next: SrtCue[]) => {
    setCues(next)
  }, [])

  const persistCues = useCallback((next: SrtCue[]) => {
    setCues(next)
    setSavedCues(next)
    onSave(next)
  }, [onSave])

  const handleSave = (next: SrtCue[]) => {
    setCues(next)
    setSavedCues(next)
    setSaving(true)
    setTimeout(() => {
      onSave(next)
      setSaving(false)
      onClose()
    }, 60)
  }

  const buildInitialCues = cues.length > 0 ? cues : undefined

  const handleStyleUpdate = (patch: Partial<LayerInstance>) => {
    onUpdateLayer(patch)
  }

  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }

  const cueCount = cues.length
  const lastCue = cues[cues.length - 1]
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
              return (
                <button key={tab.id} type="button"
                  className={`modal-tab-btn${activeTab === tab.id ? ' active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>

          <span className="srt-modal-summary">{cueSummary}</span>

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

          {activeTab === 'lyrics' && (
            <LyricsTab
              cues={cues}
              audioDuration={audioDuration}
              onCuesChange={handleCuesChange}
              onSave={handleSave}
            />
          )}
          {activeTab === 'import' && (
            <ImportTab
              cues={cues}
              savedCues={savedCues}
              onCuesChange={handleCuesChange}
              onSave={handleSave}
            />
          )}
          {activeTab === 'build' && (
            <BuildTab
              waveformPeaks={waveformPeaks}
              audioSrc={audioSrc}
              audioDuration={audioDuration}
              onAutoSave={persistCues}
              initialCues={buildInitialCues}
            />
          )}
          {activeTab === 'style' && (
            <StyleTab layer={editingLayer} onUpdate={handleStyleUpdate} />
          )}
        </div>
      </div>
    </div>
  )
}
