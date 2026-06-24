import { useCallback, useEffect, useRef, useState } from 'react'
import { AlignLeft, Bot, Download, FileText, Loader, Mic2, Palette, Plus, Trash2, Wand2, X } from 'lucide-react'
import { parseSrt, displayToMs, msToDisplay, formatSrt, MAX_SRT_CUES } from '../subtitles/parseSrt'
import type { SrtCue } from '../subtitles/parseSrt'
import { lyricsToSrt, srtToLyrics } from '../subtitles/lyricsToSrt'
import type { LayerInstance, SubtitleStyle } from '../project/types'

type TabId = 'lyrics' | 'import' | 'build' | 'ai' | 'style'

type Props = {
  onClose: () => void
  onSave: (cues: SrtCue[]) => void
  editingLayer: LayerInstance
  onUpdateLayer: (patch: Partial<LayerInstance>) => void
  waveformPeaks: number[]
  audioSrc: string | null
  audioDuration: number
}

// ─── Drag-to-scrub time input ─────────────────────────────────────────────────

function DragTimeInput({
  ms, onChangeMs, className, onFocus,
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
        autoFocus className={className} style={{ cursor: 'text' }}
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
        isDragging.current = true; hasMoved.current = false
        startX.current = e.clientX; startMs.current = ms
        e.currentTarget.setPointerCapture(e.pointerId)
        onFocus?.()
      }}
      onPointerMove={(e) => {
        if (!isDragging.current) return
        const dx = e.clientX - startX.current
        if (Math.abs(dx) > 3) hasMoved.current = true
        onChangeMs(Math.round(Math.max(0, startMs.current + dx * 40) / 100) * 100)
      }}
      onPointerUp={() => { isDragging.current = false }}
      onClick={() => {
        if (hasMoved.current) return
        setEditVal(msToDisplay(ms)); setEditing(true)
      }}
    >
      {msToDisplay(ms)}
    </span>
  )
}

// ─── Lyrics Tab ───────────────────────────────────────────────────────────────

function LyricsTab({
  rawLyrics,
  onRawLyricsChange,
  audioDuration,
  onCuesChange,
  onApply,
}: {
  rawLyrics: string
  onRawLyricsChange: (raw: string) => void
  audioDuration: number
  onCuesChange: (cues: SrtCue[]) => void
  onApply: (cues: SrtCue[]) => void
}) {
  const [converted, setConverted] = useState<SrtCue[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const durationMs = audioDuration > 0 ? audioDuration * 1000 : 0
  const durationHint = durationMs > 0
    ? `Timing fits your track (${msToDisplay(durationMs)}). Use (5s) or (1m30s) for pauses.`
    : 'No audio loaded — timing estimated from text. Use (5s) or (1m30s) to add pauses.'

  const handleTextChange = (val: string) => {
    onRawLyricsChange(val)
    setConverted(null)
    setError(null)
  }

  const handleConvert = () => {
    const trimmed = rawLyrics.trim()
    if (!trimmed) { setError('Paste or type your lyrics first.'); setConverted(null); return }

    const fromSrt = trimmed.includes('-->') ? parseSrt(trimmed) : []
    const result = fromSrt.length > 0 ? fromSrt : lyricsToSrt(trimmed, { durationMs })

    if (result.length === 0) { setError('Could not split text into lines.'); setConverted(null); return }

    onCuesChange(result)
    setConverted(result)
    setError(null)
  }

  return (
    <div className="srt-lyrics-tab">
      <p className="srt-lyrics-hint">{durationHint}</p>

      <textarea
        className="srt-lyrics-input"
        placeholder={'Paste or type lyrics…\n\nOne line per subtitle.\nUse (5s) to insert a 5-second pause.\nUse (1m30s) for longer pauses.'}
        value={rawLyrics}
        onChange={(e) => handleTextChange(e.target.value)}
        rows={12}
        spellCheck={false}
      />

      <div className="srt-lyrics-actions">
        <button type="button" className="srt-convert-btn" onClick={handleConvert} disabled={!rawLyrics.trim()}>
          <Wand2 size={13} /> Convert
        </button>
        {converted && (
          <span className="srt-convert-success">{converted.length} cues generated</span>
        )}
      </div>

      {error && <p className="srt-error">{error}</p>}

      <div className="srt-tab-actions">
        <button
          type="button" className="srt-add-btn"
          onClick={() => converted && onApply(converted)}
          disabled={!converted}
        >
          Apply
        </button>
      </div>
    </div>
  )
}

// ─── Import / SRT Tab ─────────────────────────────────────────────────────────

function ImportTab({
  cues, savedCues, onCuesChange, onApply,
}: {
  cues: SrtCue[]
  savedCues: SrtCue[]
  onCuesChange: (cues: SrtCue[]) => void
  onApply: (cues: SrtCue[]) => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [filename, setFilename] = useState<string | null>(cues.length ? 'current cues' : null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [srtText, setSrtText] = useState(() => cues.length ? formatSrt(cues) : '')
  const [srtError, setSrtError] = useState<string | null>(null)
  const isEditingRef = useRef(false)

  // Sync textarea when cues change from another tab's Apply
  useEffect(() => {
    if (!isEditingRef.current) {
      setSrtText(cues.length ? formatSrt(cues) : '')
    }
  }, [cues])

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
        setSrtText(formatSrt(parsed))
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

  const handleSrtApply = () => {
    const trimmed = srtText.trim()
    if (!trimmed) { setSrtError('Enter SRT content to apply.'); return }
    const parsed = parseSrt(trimmed)
    if (parsed.length === 0) { setSrtError('Could not parse SRT — check the format.'); return }
    setSrtError(null)
    isEditingRef.current = false
    onApply(parsed)
  }

  const lastCue = cues[cues.length - 1]
  const durationLabel = lastCue ? msToDisplay(lastCue.endMs) : null

  return (
    <div className="srt-import-tab">
      <input ref={fileRef} type="file" accept=".srt" hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
      />

      <div
        className={`srt-dropzone srt-dropzone--compact${dragging ? ' srt-dropzone--drag' : ''}${cues.length ? ' srt-dropzone--loaded' : ''}`}
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
            <span className="srt-browse-hint">click to replace with .srt file</span>
          </div>
        ) : (
          <div className="srt-dropzone-idle">
            <FileText size={24} className="srt-drop-icon" />
            <p>Drop .srt file here</p>
            <span className="srt-browse-hint">or click to browse</span>
          </div>
        )}
      </div>

      {error && <p className="srt-error">{error}</p>}
      {cues.length >= MAX_SRT_CUES && (
        <p className="srt-warning">Large file — capped at {MAX_SRT_CUES} cues.</p>
      )}

      <div className="srt-source-panel">
        <p className="srt-source-label">SRT</p>
        <textarea
          className="srt-source-input"
          rows={10}
          value={srtText}
          placeholder={'Paste or edit SRT directly…\n\n1\n00:00:00,000 --> 00:00:02,500\nYour lyric here'}
          spellCheck={false}
          onFocus={() => { isEditingRef.current = true }}
          onBlur={() => { isEditingRef.current = false }}
          onChange={(e) => { setSrtText(e.target.value); setSrtError(null) }}
        />
        {srtError && <p className="srt-error">{srtError}</p>}
      </div>

      <div className="srt-tab-actions">
        <button type="button" className="srt-add-btn" onClick={handleSrtApply}>
          Apply
        </button>
      </div>
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
  waveformPeaks, audioSrc, audioDuration, onAutoSave, onApply, initialCues,
}: {
  waveformPeaks: number[]
  audioSrc: string | null
  audioDuration: number
  onAutoSave: (cues: SrtCue[]) => void
  onApply: (cues: SrtCue[]) => void
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
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return }
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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const t = e.target as Element
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return
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
      const next = newCueAfter(prev[idx])
      const result = [...prev]
      result.splice(idx + 1, 0, next)
      setTimeout(() => { setFocusedId(next.id); textRefs.current.get(next.id)?.focus() }, 0)
      return result
    })
  }, [])

  const removeCue = (id: string) => {
    setCues((prev) => {
      const next = prev.filter((c) => c.id !== id)
      if (next.length === 0) {
        const fresh = newCueAfter(); setFocusedId(fresh.id); return [fresh]
      }
      if (focusedId === id) setFocusedId(next[Math.max(0, prev.findIndex((c) => c.id === id) - 1)].id)
      return next
    })
  }

  const updateCue = (id: string, patch: Partial<BuildCue>) => {
    setCues((prev) => prev.map((c) => c.id === id ? { ...c, ...patch } : c))
  }

  const handleTextEnter = useCallback((cueId: string) => {
    setCues((prev) => {
      const idx = prev.findIndex((c) => c.id === cueId)
      if (idx === -1) return prev
      const endMs = isPlaying ? currentMs : prev[idx].endMs
      const updated = prev.map((c, i) => i === idx ? { ...c, endMs } : c)
      const next = newCueAfter(updated[idx])
      const result = [...updated]
      result.splice(idx + 1, 0, next)
      setTimeout(() => { setFocusedId(next.id); textRefs.current.get(next.id)?.focus() }, 0)
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

      <div className="srt-time-hero">
        <div className="srt-time-hero-clock">{msToDisplay(currentMs)}</div>
        {duration > 0 && <div className="srt-time-hero-total">/ {msToDisplay(duration * 1000)}</div>}
      </div>

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

      <div className="srt-transport">
        <button type="button" className="srt-play-btn" onClick={togglePlay} disabled={!audioSrc}
          aria-label={isPlaying ? 'Pause' : 'Play'}>
          {isPlaying ? '⏸' : '▶'}
        </button>
        <div className="srt-mark-btns">
          <button type="button" className="srt-mark-btn" onClick={markStart} disabled={!audioSrc}
            title="Stamp current time as start  ( [ )">[ Mark Start</button>
          <button type="button" className="srt-mark-btn" onClick={markEnd} disabled={!audioSrc}
            title="Stamp current time as end  ( ] )">Mark End ]</button>
        </div>
        {focusedCue && (
          <span className="srt-focused-range">
            {msToDisplay(focusedCue.startMs)} → {msToDisplay(focusedCue.endMs)}
          </span>
        )}
      </div>

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
              <DragTimeInput ms={cue.startMs} onChangeMs={(v) => updateCue(cue.id, { startMs: v })}
                className="srt-cue-time" onFocus={() => setFocusedId(cue.id)} />
              <DragTimeInput ms={cue.endMs} onChangeMs={(v) => updateCue(cue.id, { endMs: v })}
                className="srt-cue-time" onFocus={() => setFocusedId(cue.id)} />
              <input
                ref={(el) => { el ? textRefs.current.set(cue.id, el) : textRefs.current.delete(cue.id) }}
                className="srt-cue-text" placeholder="Type line…"
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

      <div className="srt-tab-actions srt-tab-actions--split">
        <button type="button" className="srt-secondary-btn" onClick={() => addCue()}>
          <Plus size={13} /> Add Line
        </button>
        <button type="button" className="srt-add-btn" onClick={() => onApply(buildCuesToSrt(cues))}>
          Apply
        </button>
      </div>
    </div>
  )
}

// ─── AI Tab ───────────────────────────────────────────────────────────────────

type AiProvider = 'whisper' | 'audioshake'
type AiStatus = 'idle' | 'uploading' | 'processing' | 'done' | 'error'

const AI_STATUS_LABEL: Record<AiStatus, string> = {
  idle:       '',
  uploading:  'Uploading audio…',
  processing: 'Transcribing…',
  done:       'Done',
  error:      '',
}

function downloadSrt(rawSrt: string) {
  const blob = new Blob([rawSrt], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'transcript.srt'
  a.click()
  URL.revokeObjectURL(url)
}

function AiTab({
  audioSrc,
  rawLyrics,
  onApply,
}: {
  audioSrc: string | null
  rawLyrics: string
  onApply: (cues: SrtCue[]) => void
}) {
  const [provider, setProvider] = useState<AiProvider>('whisper')
  const [useLyrics, setUseLyrics] = useState(true)
  const [status, setStatus] = useState<AiStatus>('idle')
  const [resultSrt, setResultSrt] = useState('')
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const handleTranscribe = async () => {
    if (!audioSrc) return
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    setError(null)
    setResultSrt('')

    try {
      setStatus('uploading')
      const audioRes = await fetch(audioSrc, { signal: ctrl.signal })
      if (!audioRes.ok) throw new Error('Could not read audio file.')
      const audioBlob = await audioRes.blob()

      const form = new FormData()
      form.append('audio', audioBlob, 'audio.mp3')
      form.append('provider', provider)
      if (useLyrics && rawLyrics.trim()) form.append('lyrics', rawLyrics.trim())

      setStatus('processing')
      const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'
      const res = await fetch(`${apiBase}/ai/transcribe`, {
        method: 'POST',
        body: form,
        credentials: 'include',
        signal: ctrl.signal,
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error((body as any).error ?? 'Transcription failed.')
      }

      const data = await res.json() as { rawSrt: string }
      setResultSrt(data.rawSrt)
      setStatus('done')
    } catch (e: any) {
      if (e?.name === 'AbortError') return
      setError(e.message ?? 'Unknown error.')
      setStatus('error')
    }
  }

  useEffect(() => () => { abortRef.current?.abort() }, [])

  const handleApply = () => {
    const cues = parseSrt(resultSrt)
    if (cues.length > 0) onApply(cues)
  }

  const isBusy = status === 'uploading' || status === 'processing'

  return (
    <div className="srt-ai-tab">
      {/* Provider picker */}
      <div className="srt-ai-providers">
        <button
          type="button"
          className={`srt-ai-provider-btn${provider === 'whisper' ? ' active' : ''}`}
          onClick={() => setProvider('whisper')}
        >
          <span className="srt-ai-provider-name">Whisper</span>
          <span className="srt-ai-provider-sub">OpenAI · speech-to-text</span>
        </button>
        <button
          type="button"
          className={`srt-ai-provider-btn srt-ai-provider-btn--soon${provider === 'audioshake' ? ' active' : ''}`}
          onClick={() => setProvider('audioshake')}
        >
          <span className="srt-ai-provider-name">AudioShake <span className="srt-ai-soon">soon</span></span>
          <span className="srt-ai-provider-sub">lyric-aligned transcript</span>
        </button>
      </div>

      {/* Options */}
      {rawLyrics.trim() && (
        <label className="srt-ai-option">
          <input type="checkbox" checked={useLyrics} onChange={(e) => setUseLyrics(e.target.checked)} />
          <span>Use lyrics as vocabulary hint</span>
        </label>
      )}

      {!audioSrc && (
        <p className="srt-ai-no-audio">Load an audio track in the editor before transcribing.</p>
      )}

      {/* Transcribe button */}
      <div className="srt-ai-actions">
        <button
          type="button"
          className="srt-ai-run-btn"
          onClick={handleTranscribe}
          disabled={!audioSrc || isBusy}
        >
          {isBusy ? <Loader size={14} className="srt-spinner" /> : <Bot size={14} />}
          {isBusy ? AI_STATUS_LABEL[status] : 'Transcribe Audio'}
        </button>
      </div>

      {/* Progress feedback */}
      {isBusy && (
        <div className="srt-ai-progress">
          <div className="srt-ai-progress-bar">
            <div className={`srt-ai-progress-fill${status === 'processing' ? ' srt-ai-progress-fill--indeterminate' : ''}`} />
          </div>
          <p className="srt-ai-progress-label">{AI_STATUS_LABEL[status]}</p>
        </div>
      )}

      {error && <p className="srt-error">{error}</p>}

      {/* Result */}
      {status === 'done' && (
        <>
          <div className="srt-source-panel">
            <p className="srt-source-label">Transcript (SRT)</p>
            <textarea
              className="srt-source-input"
              rows={10}
              value={resultSrt}
              spellCheck={false}
              onChange={(e) => setResultSrt(e.target.value)}
            />
          </div>

          <div className="srt-tab-actions srt-tab-actions--split">
            <button
              type="button"
              className="srt-secondary-btn"
              onClick={() => downloadSrt(resultSrt)}
            >
              <Download size={13} /> Save .srt
            </button>
            <button
              type="button"
              className="srt-add-btn"
              onClick={handleApply}
              disabled={!resultSrt.trim()}
            >
              Apply
            </button>
          </div>
        </>
      )}
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
  { id: 'top',    label: 'Top',    offsetY: 85 },
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
      <section className="srt-style-section">
        <p className="srt-section-label">Appearance</p>
        <div className="srt-style-sliders">
          <label className="srt-slider-row">
            <span>Position</span>
            <select className="srt-select" value={position}
              onChange={(e) => {
                const next = SUBTITLE_POSITIONS.find((p) => p.id === e.target.value)
                if (next) onUpdate({ settings: { ...layer.settings, subtitleOffsetY: next.offsetY } })
              }}>
              {SUBTITLE_POSITIONS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
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
  { id: 'lyrics', label: 'Lyrics',  icon: Mic2      },
  { id: 'import', label: 'SRT',     icon: FileText  },
  { id: 'build',  label: 'Build',   icon: AlignLeft },
  { id: 'ai',     label: 'AI',      icon: Bot       },
  { id: 'style',  label: 'Style',   icon: Palette   },
]

export function SubtitleModal({
  onClose, onSave, editingLayer, onUpdateLayer,
  waveformPeaks, audioSrc, audioDuration,
}: Props) {
  const initialCues = (editingLayer.settings.cues ?? []) as SrtCue[]
  const defaultTab: TabId = initialCues.length > 0 ? 'build' : 'lyrics'
  const [activeTab, setActiveTab] = useState<TabId>(defaultTab)
  const [applying, setApplying] = useState(false)

  // ── Shared timeline state ───────────────────────────────────────────────
  const [cues, setCues] = useState<SrtCue[]>(initialCues)
  const [savedCues, setSavedCues] = useState<SrtCue[]>(initialCues)

  // rawLyrics is lifted so Lyrics tab survives tab switches.
  // Initialized from existing cues so opening a loaded layer shows lyrics view.
  const [rawLyrics, setRawLyrics] = useState<string>(() =>
    initialCues.length ? srtToLyrics(initialCues) : '',
  )

  // Incrementing this key remounts BuildTab so it re-seeds from updated cues.
  const [buildVersion, setBuildVersion] = useState(0)

  // ── Apply handler ───────────────────────────────────────────────────────
  // source:
  //   'lyrics' — don't rewrite rawLyrics (preserve user's text), reset Build
  //   'srt'    — regenerate rawLyrics from new cues, reset Build
  //   'build'  — regenerate rawLyrics from new cues, don't reset Build
  const handleApply = useCallback((
    next: SrtCue[],
    source: 'lyrics' | 'srt' | 'build',
  ) => {
    setCues(next)
    setSavedCues(next)
    onSave(next)
    if (source !== 'lyrics') setRawLyrics(srtToLyrics(next))
    if (source !== 'build')  setBuildVersion((v) => v + 1)
  }, [onSave])

  // persistCues is for Build's auto-save: keeps cues in sync without
  // disturbing rawLyrics or forcing a Build remount mid-edit.
  const persistCues = useCallback((next: SrtCue[]) => {
    setCues(next)
    setSavedCues(next)
    onSave(next)
  }, [onSave])

  const handleCuesChange = useCallback((next: SrtCue[]) => setCues(next), [])

  const withFlash = (fn: () => void) => {
    setApplying(true)
    setTimeout(() => { fn(); setApplying(false) }, 60)
  }

  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }

  const cueCount = cues.length
  const lastCue = cues[cues.length - 1]
  const cueSummary = cueCount > 0
    ? `${cueCount} cues · ${msToDisplay(lastCue?.endMs ?? 0)}`
    : 'No cues loaded'

  return (
    <div className="modal-backdrop" onClick={handleBackdrop}>
      <div className="media-modal srt-modal">
        <div className="fx-browser-tools">
          <div className="modal-tab-strip">
            {TABS.map((tab) => (
              <button key={tab.id} type="button"
                className={`modal-tab-btn${activeTab === tab.id ? ' active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <span className="srt-modal-summary">{cueSummary}</span>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="srt-modal-body">
          {applying && (
            <div className="srt-adding-overlay">
              <Loader size={24} className="srt-spinner" />
            </div>
          )}

          {activeTab === 'lyrics' && (
            <LyricsTab
              rawLyrics={rawLyrics}
              onRawLyricsChange={setRawLyrics}
              audioDuration={audioDuration}
              onCuesChange={handleCuesChange}
              onApply={(next) => withFlash(() => handleApply(next, 'lyrics'))}
            />
          )}
          {activeTab === 'import' && (
            <ImportTab
              cues={cues}
              savedCues={savedCues}
              onCuesChange={handleCuesChange}
              onApply={(next) => withFlash(() => handleApply(next, 'srt'))}
            />
          )}
          {activeTab === 'build' && (
            <BuildTab
              key={buildVersion}
              waveformPeaks={waveformPeaks}
              audioSrc={audioSrc}
              audioDuration={audioDuration}
              onAutoSave={persistCues}
              onApply={(next) => handleApply(next, 'build')}
              initialCues={cues.length > 0 ? cues : undefined}
            />
          )}
          {activeTab === 'ai' && (
            <AiTab
              audioSrc={audioSrc}
              rawLyrics={rawLyrics}
              onApply={(next) => withFlash(() => handleApply(next, 'srt'))}
            />
          )}
          {activeTab === 'style' && (
            <StyleTab layer={editingLayer} onUpdate={onUpdateLayer} />
          )}
        </div>
      </div>
    </div>
  )
}
