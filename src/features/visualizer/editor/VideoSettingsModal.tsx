import { useEffect, useRef, useState } from 'react'
import { Film, Pause, Play, X, Zap } from 'lucide-react'
import type { LayerInstance } from '../project/types'

// ── Time helpers ─────────────────────────────────────────────────────────────

function fmtMs(ms: number): string {
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${pad(m)}:${pad(sec)}`
  return `${m}:${pad(sec)}`
}

function pad(n: number) { return String(n).padStart(2, '0') }

const SPEEDS = [0.25, 0.5, 1, 2, 3] as const

// ── Dual-handle range slider ──────────────────────────────────────────────────

type DualRangeProps = {
  min: number
  max: number
  start: number
  end: number
  disabled?: boolean
  onStartChange: (v: number) => void
  onEndChange: (v: number) => void
}

function DualRange({ min, max, start, end, disabled, onStartChange, onEndChange }: DualRangeProps) {
  const span = max - min || 1
  const startPct = ((start - min) / span) * 100
  const endPct = ((end - min) / span) * 100

  return (
    <div className="vsm-dual-range">
      <div className="vsm-dual-track">
        <div className="vsm-dual-fill" style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }} />
      </div>
      <input
        type="range"
        className="vsm-range vsm-range-start"
        min={min} max={max} step={500}
        value={start}
        disabled={disabled}
        style={{ zIndex: startPct > 95 ? 5 : 3 }}
        onChange={(e) => onStartChange(Math.max(min, Math.min(Number(e.target.value), end - 500)))}
      />
      <input
        type="range"
        className="vsm-range vsm-range-end"
        min={min} max={max} step={500}
        value={end}
        disabled={disabled}
        style={{ zIndex: 4 }}
        onChange={(e) => onEndChange(Math.min(max, Math.max(Number(e.target.value), start + 500)))}
      />
    </div>
  )
}

// ── Component ────────────────────────────────────────────────────────────────

type Props = {
  layer: LayerInstance
  onClose: () => void
  onUpdate: (patch: Partial<LayerInstance>) => void
}

export function VideoSettingsModal({ layer, onClose, onUpdate }: Props) {
  const src = String(layer.settings.src ?? '')
  const [videoDuration, setVideoDuration] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const previewRef = useRef<HTMLVideoElement>(null)

  const startMs = Number(layer.settings.videoStartMs ?? 0)
  const endMs   = layer.settings.videoEndMs != null ? Number(layer.settings.videoEndMs) : null
  const rate    = Number(layer.settings.playbackRate ?? 1)
  const loop    = layer.settings.videoLoop !== false
  const bassSrc = String(layer.settings.bassSource ?? 'main')
  const effEnd  = endMs ?? videoDuration

  function set(patch: Record<string, unknown>) { onUpdate({ settings: patch }) }

  function seek(ms: number) {
    const v = previewRef.current
    if (v) v.currentTime = ms / 1000
  }

  function togglePreview() {
    const v = previewRef.current
    if (!v) return
    if (isPlaying) {
      v.pause()
      setIsPlaying(false)
    } else {
      v.currentTime = startMs / 1000
      v.playbackRate = rate
      v.play().then(() => setIsPlaying(true)).catch(() => {})
    }
  }

  useEffect(() => {
    const v = previewRef.current
    if (!v || !isPlaying) return
    function check() {
      if (!v) return
      const capMs = effEnd > 0 ? effEnd : Infinity
      if (v.currentTime * 1000 >= capMs) { v.pause(); setIsPlaying(false) }
    }
    v.addEventListener('timeupdate', check)
    return () => v.removeEventListener('timeupdate', check)
  }, [isPlaying, effEnd])

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="vsm-panel">

        {/* ── Header ─────────────────────────────────────────── */}
        <div className="vsm-header">
          <Film size={14} className="vsm-header-icon" />
          <span>Video Settings</span>
          <button className="vsm-close" onClick={onClose}><X size={14} /></button>
        </div>

        {/* ── Preview ────────────────────────────────────────── */}
        <div className="vsm-preview">
          <video
            ref={previewRef}
            src={src}
            className="vsm-preview-video"
            muted playsInline
            onLoadedMetadata={(e) => {
              const d = e.currentTarget.duration
              if (isFinite(d) && d > 0) {
                setVideoDuration(d * 1000)
                e.currentTarget.currentTime = startMs / 1000
              }
            }}
            onEnded={() => setIsPlaying(false)}
          />
          {videoDuration > 0 && (
            <div className="vsm-preview-badge">{fmtMs(videoDuration)}</div>
          )}
          <button
            className={`vsm-play-btn${isPlaying ? ' playing' : ''}`}
            onClick={togglePreview}
            disabled={videoDuration === 0}
            title={isPlaying ? 'Pause preview' : 'Preview clip'}
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          </button>
        </div>

        {/* ── Clip Range ─────────────────────────────────────── */}
        <div className="vsm-section">
          <div className="vsm-section-title">Clip Range</div>

          <DualRange
            min={0}
            max={videoDuration || 1}
            start={startMs}
            end={effEnd || 1}
            disabled={videoDuration === 0}
            onStartChange={(v) => { set({ videoStartMs: v }); seek(v) }}
            onEndChange={(v) => {
              if (v >= (videoDuration - 500)) set({ videoEndMs: null })
              else { set({ videoEndMs: v }); seek(v) }
            }}
          />

          <div className="vsm-clip-times">
            <span>{fmtMs(startMs)}</span>
            <span>{endMs != null ? fmtMs(endMs) : (videoDuration > 0 ? fmtMs(videoDuration) : '—')}</span>
          </div>
        </div>

        {/* ── Speed ──────────────────────────────────────────── */}
        <div className="vsm-section">
          <div className="vsm-section-title">Playback Speed</div>
          <div className="vsm-speed-row">
            {SPEEDS.map((s) => (
              <button
                key={s}
                className={`vsm-speed-btn${rate === s ? ' active' : ''}`}
                onClick={() => set({ playbackRate: s })}
              >
                {s}×
              </button>
            ))}
          </div>
        </div>

        {/* ── Loop ───────────────────────────────────────────── */}
        <div className="vsm-section vsm-toggle-row">
          <div>
            <div className="vsm-section-title">Loop Clip</div>
            <div className="vsm-row-desc">Repeat the trimmed segment during playback</div>
          </div>
          <button
            className={`vsm-toggle-btn${loop ? ' active' : ''}`}
            onClick={() => set({ videoLoop: !loop })}
          >
            {loop ? 'On' : 'Off'}
          </button>
        </div>

        {/* ── Bass FX ────────────────────────────────────────── */}
        <div className="vsm-section vsm-bass-section">
          <div className="vsm-toggle-row">
            <div>
              <div className="vsm-section-title vsm-bass-title">
                <Zap size={12} />
                Add Bass FX
              </div>
              <div className="vsm-row-desc">
                Drive this layer's reactions from the video's own audio — independent of the main track
              </div>
            </div>
            <button
              className={`vsm-toggle-btn${bassSrc === 'video' ? ' active' : ''}`}
              onClick={() => set({ bassSource: bassSrc === 'video' ? 'main' : 'video' })}
            >
              {bassSrc === 'video' ? 'On' : 'Off'}
            </button>
          </div>
          {bassSrc === 'video' && (
            <p className="vsm-bass-note">
              Pulse and effects on this layer react to the video's own bass groove in real time.
            </p>
          )}
        </div>

      </div>
    </div>
  )
}
