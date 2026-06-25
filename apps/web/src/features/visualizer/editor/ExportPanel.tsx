import { useEffect, useMemo, useState } from 'react'
import { Download, Image, Loader2, Video, X } from 'lucide-react'
import { exportFileBase } from '../export/exportTitle'
import { EXPORT_PRESETS, DEFAULT_PRESET_ID, getPreset, type ExportPreset, type PresetId } from '../export/presets'
import type { RendererDiagnostics } from '../export/rendererSupport'
import type { FrameStats, WebCodecsExportPhase } from '../export/webcodecs'

type Props = {
  hasAudio: boolean
  suggestedTitle: string
  isExportingPng: boolean
  isPreparing: boolean
  preparePhase: string
  prepareProgress: number
  isExportingVideo: boolean
  videoProgress: number
  exportPhase: WebCodecsExportPhase | ''
  rendererMode: 'native' | 'compat'
  rendererDiagnostics: RendererDiagnostics | null
  hasAudioEncoder: boolean
  exportStats: FrameStats | null
  onExportPng: (title: string) => void
  onExportWebm: (title: string, preset: ExportPreset) => void
  onCancelVideo: () => void
  lastExport: { filename: string; mimeType: string } | null
  onDownloadLastExport: () => void
  onClearLastExport: () => void
  onClose: () => void
}

type Diagnostics = {
  webCodecs: boolean
  audioEncoder: boolean
  mediaRecorder: boolean
  mrCodec: string
  captureStream: boolean
}

function getDiagnostics(): Diagnostics {
  const hasMR = typeof MediaRecorder !== 'undefined'
  const mrCodec = hasMR
    ? (['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find(
        (t) => MediaRecorder.isTypeSupported(t)
      ) ?? 'none')
    : 'unavailable'
  return {
    webCodecs: typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined',
    audioEncoder: typeof AudioEncoder !== 'undefined' && typeof AudioData !== 'undefined',
    mediaRecorder: hasMR,
    mrCodec,
    captureStream: typeof HTMLCanvasElement !== 'undefined' && 'captureStream' in HTMLCanvasElement.prototype,
  }
}

const phaseLabels: Record<WebCodecsExportPhase, string> = {
  'encoding-frames': 'Encoding frames',
  'flushing-video': 'Flushing video encoder',
  'muxing-audio': 'Muxing audio',
  'finalizing-webm': 'Finalizing WebM',
  'creating-blob': 'Creating download',
  complete: 'Starting download',
}

export function ExportPanel({ hasAudio, suggestedTitle, isExportingPng, isPreparing, preparePhase, prepareProgress, isExportingVideo, videoProgress, exportPhase, rendererMode, rendererDiagnostics, hasAudioEncoder, exportStats, onExportPng, onExportWebm, onCancelVideo, lastExport, onDownloadLastExport, onClearLastExport, onClose }: Props) {
  const diag = useMemo(() => getDiagnostics(), [])
  const canWebCodecs = diag.webCodecs
  const canAudio = canWebCodecs ? diag.audioEncoder : true
  const canMediaRecorder = diag.mediaRecorder && diag.mrCodec !== 'none' && diag.mrCodec !== 'unavailable' && diag.captureStream
  const canWebm = canWebCodecs || canMediaRecorder
  const exportEngine = canWebCodecs ? 'WebCodecs' : 'MediaRecorder'
  const exportEngineDetail = canWebCodecs
    ? diag.audioEncoder
      ? 'VP9 + Opus · frame-accurate'
      : 'VP9 · frame-accurate · video only'
    : canMediaRecorder
      ? `${diag.mrCodec.replace('video/', '')} · canvas + audio`
      : 'Not available'
  // VP9 is the default codec. AV1 is not enabled by default due to slow software encoding.
  const busy = isExportingPng || isPreparing || isExportingVideo
  const locked = isPreparing || isExportingVideo
  const [webmConfirmOpen, setWebmConfirmOpen] = useState(false)
  const [title, setTitle] = useState(suggestedTitle)
  const [presetId, setPresetId] = useState<PresetId>(() => {
    const stored = localStorage.getItem('avl-export-preset-id')
    return (stored === 'draft' || stored === 'standard' || stored === 'high' || stored === 'smooth')
      ? stored
      : DEFAULT_PRESET_ID
  })

  useEffect(() => {
    setTitle(suggestedTitle)
  }, [suggestedTitle])

  useEffect(() => {
    localStorage.setItem('avl-export-preset-id', presetId)
  }, [presetId])

  const preset = getPreset(presetId)
  const fileBase = exportFileBase(title)

  const rendererLabel = rendererMode === 'native' ? 'Canvas native' : 'html2canvas compat'
  const presetVideoCodecLabel = preset.videoCodec === 'vp8'
    ? 'VP8/VP9'
    : preset.videoCodec === 'auto'
      ? 'AV1/VP9'
      : 'VP9'
  const videoCodecLabel = !canWebCodecs ? 'MediaRecorder' : presetVideoCodecLabel
  const audioCodecLabel = !canWebCodecs
    ? 'Captured'
    : hasAudio && hasAudioEncoder
      ? 'Opus 192k'
      : hasAudio
        ? 'None'
        : '—'

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget || locked) return
    onClose()
  }

  const handleClose = () => {
    if (locked) return
    setWebmConfirmOpen(false)
    onClose()
  }

  const startWebmExport = () => {
    setWebmConfirmOpen(false)
    onExportWebm(title.trim() || suggestedTitle, preset)
  }

  if (isPreparing) {
    const pct = Math.round(prepareProgress * 100)
    return (
      <div className="modal-backdrop modal-backdrop--locked" onClick={handleBackdropClick}>
        <div className="export-panel export-panel--compiling">
          <div className="export-compile-header">
            <Loader2 size={18} className="export-compile-spinner" />
            <span>Preparing export · {preset.label}…</span>
          </div>
          <div className="export-progress-wrap export-progress-wrap--compile">
            <div className="export-progress-bar">
              <div style={{ width: `${pct}%` }} />
            </div>
            <span className="export-progress-pct">{pct}%</span>
          </div>
          {preparePhase && <p className="export-compile-note">{preparePhase}</p>}
          <button className="export-cancel-btn export-cancel-btn--compile" onClick={onCancelVideo}>Cancel</button>
        </div>
      </div>
    )
  }

  if (isExportingVideo) {
    const pct = Math.round(videoProgress * 100)
    const phaseLabel = exportPhase ? phaseLabels[exportPhase] : 'Compiling'
    const etaLabel = exportStats && exportStats.etaSec > 0
      ? `ETA ${exportStats.etaSec < 60 ? `${exportStats.etaSec}s` : `${Math.ceil(exportStats.etaSec / 60)}m`}`
      : ''
    const frameLabel = exportStats && exportPhase !== 'complete'
      ? `${exportStats.frame}/${exportStats.totalFrames} · ${exportStats.msPerFrame.toFixed(0)} ms/f · ${exportStats.encodedFps.toFixed(1)} fps · ${exportStats.realtimeFactor.toFixed(2)}×`
      : ''
    const slowExportLabel = exportStats && exportStats.etaSec > 600 && preset.id !== 'draft'
      ? 'Long export estimate. Draft Fast will be much quicker.'
      : ''
    return (
      <div className="modal-backdrop modal-backdrop--locked" onClick={handleBackdropClick}>
        <div className="export-panel export-panel--compiling">
          <div className="export-compile-header">
            <Loader2 size={18} className="export-compile-spinner" />
            <span>{phaseLabel} · {preset.label} · {videoCodecLabel} · {rendererLabel}…</span>
          </div>
          <div className="export-progress-wrap export-progress-wrap--compile">
            <div className="export-progress-bar">
              <div style={{ width: `${pct}%` }} />
            </div>
            <span className="export-progress-pct">{pct}%{etaLabel ? ` · ${etaLabel}` : ''}</span>
          </div>
          <p className="export-compile-note">{slowExportLabel || frameLabel || phaseLabel}</p>
          <button className="export-cancel-btn export-cancel-btn--compile" onClick={onCancelVideo}>Cancel compile</button>
        </div>
      </div>
    )
  }

  if (webmConfirmOpen) {
    return (
      <div className="modal-backdrop" onClick={handleBackdropClick}>
        <div className="export-panel">
          <div className="export-panel-header">
            <span>Compile video</span>
            <button onClick={() => setWebmConfirmOpen(false)}><X size={15} /></button>
          </div>
          <div className="export-confirm">
            <div className="export-preset-row">
              {EXPORT_PRESETS.map((p) => (
                <button
                  key={p.id}
                  className={`export-preset-btn${p.id === presetId ? ' export-preset-btn--active' : ''}`}
                  onClick={() => setPresetId(p.id)}
                >
                  {p.label}
                  <span>{p.fps}fps · {p.videoCodec === 'vp8' ? 'VP8' : p.videoCodec === 'auto' ? 'AV1' : 'VP9'}</span>
                </button>
              ))}
            </div>
            <p className="export-preset-desc">{preset.description}</p>
            <dl className="export-tech-table">
              <dt>Renderer</dt><dd>{rendererLabel}</dd>
              <dt>Video</dt>  <dd>{videoCodecLabel}</dd>
              <dt>Audio</dt>  <dd>{audioCodecLabel}</dd>
              {rendererDiagnostics && (
                <>
                  <dt>Layers</dt>
                  <dd>{rendererDiagnostics.supportedLayers}/{rendererDiagnostics.totalLayers} supported natively</dd>
                  {rendererDiagnostics.fallbackReason && (
                    <>
                      <dt>Fallback</dt>
                      <dd className="export-tech-fallback">{rendererDiagnostics.fallbackReason}</dd>
                    </>
                  )}
                </>
              )}
            </dl>
            <p className="export-confirm-filename">{fileBase}.webm</p>
            <ul>
              <li>Edits made after you confirm will not appear in the export</li>
              <li>Keep this dialog open until the download starts</li>
              {canWebCodecs
                ? <li>Export is offline — may take longer than playback time</li>
                : <li>Compile time matches your audio length</li>
              }
            </ul>
            <div className="export-confirm-actions">
              <button className="export-confirm-back" onClick={() => setWebmConfirmOpen(false)}>Back</button>
              <button className="export-confirm-start" onClick={startWebmExport}>Start compile</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="export-panel">
        <div className="export-panel-header">
          <span>Export</span>
          <button onClick={handleClose}><X size={15} /></button>
        </div>

        <div className="export-title-field">
          <label htmlFor="export-title">Project title</label>
          <input
            id="export-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={suggestedTitle}
            disabled={busy}
            maxLength={120}
            autoComplete="off"
          />
          <span className="export-title-filename">{fileBase}.png · {fileBase}.webm</span>
        </div>

        <div className="export-actions">
          <button className="export-btn" onClick={() => onExportPng(title.trim() || suggestedTitle)} disabled={busy}>
            <Image size={16} />
            <div>
              <strong>PNG Still</strong>
              <span>Current frame · full resolution</span>
            </div>
            {isExportingPng ? <span className="export-working">…</span> : <Download size={13} />}
          </button>

          <button
            className="export-btn"
            onClick={() => setWebmConfirmOpen(true)}
            disabled={!canWebm || !hasAudio || busy}
            title={!canWebm ? 'Video export unavailable in this browser' : !hasAudio ? 'Upload audio first' : undefined}
          >
            <Video size={16} />
            <div>
              <strong>Video (WebM)</strong>
              <span>{exportEngineDetail}</span>
            </div>
            <Download size={13} />
          </button>
        </div>

        {lastExport && (
          <div className="export-last">
            <button className="export-btn export-btn--redownload" onClick={onDownloadLastExport} disabled={busy}>
              <Download size={14} />
              <div>
                <strong>Re-download</strong>
                <span>{lastExport.filename}</span>
              </div>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
