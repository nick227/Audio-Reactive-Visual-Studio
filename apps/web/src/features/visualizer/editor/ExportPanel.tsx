import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, CheckCircle, Download, Image, Loader2, Video, X } from 'lucide-react'
import { exportFileBase } from '../export/exportTitle'

type Props = {
  hasAudio: boolean
  suggestedTitle: string
  isExportingPng: boolean
  isExportingVideo: boolean
  videoProgress: number
  onExportPng: (title: string) => void
  onExportWebm: (title: string) => void
  onCancelVideo: () => void
  onClose: () => void
}

type Diagnostics = {
  mediaRecorder: boolean
  mrCodec: string
  videoEncoder: boolean
  captureStream: boolean
  crossOriginIsolated: boolean
  sharedArrayBuffer: boolean
}

function getDiagnostics(): Diagnostics {
  const hasMR = typeof MediaRecorder !== 'undefined'
  const mrCodec = hasMR
    ? (['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find(
        (t) => MediaRecorder.isTypeSupported(t)
      ) ?? 'none')
    : 'unavailable'
  return {
    mediaRecorder: hasMR,
    mrCodec,
    videoEncoder: 'VideoEncoder' in window,
    captureStream: typeof HTMLCanvasElement !== 'undefined' && 'captureStream' in HTMLCanvasElement.prototype,
    crossOriginIsolated: window.crossOriginIsolated ?? false,
    sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
  }
}

export function ExportPanel({ hasAudio, suggestedTitle, isExportingPng, isExportingVideo, videoProgress, onExportPng, onExportWebm, onCancelVideo, onClose }: Props) {
  const diag = useMemo(() => getDiagnostics(), [])
  const canWebm = diag.mediaRecorder && diag.mrCodec !== 'none' && diag.mrCodec !== 'unavailable' && diag.captureStream
  const busy = isExportingPng || isExportingVideo
  const locked = isExportingVideo
  const [webmConfirmOpen, setWebmConfirmOpen] = useState(false)
  const [title, setTitle] = useState(suggestedTitle)

  useEffect(() => {
    setTitle(suggestedTitle)
  }, [suggestedTitle])

  const fileBase = exportFileBase(title)

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
    onExportWebm(title.trim() || suggestedTitle)
  }

  if (isExportingVideo) {
    const pct = Math.round(videoProgress * 100)
    return (
      <div className="modal-backdrop modal-backdrop--locked" onClick={handleBackdropClick}>
        <div className="export-panel export-panel--compiling">
          <div className="export-compile-header">
            <Loader2 size={18} className="export-compile-spinner" />
            <span>Compiling video…</span>
          </div>
          <div className="export-progress-wrap export-progress-wrap--compile">
            <div className="export-progress-bar">
              <div style={{ width: `${pct}%` }} />
            </div>
            <span className="export-progress-pct">{pct}%</span>
          </div>
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
            <p>Your canvas will be compiled with audio.</p>
            <p className="export-confirm-filename">{fileBase}.webm</p>
            <ul>
              <li>Edits made after you confirm will not appear in the export</li>
              <li>Keep this dialog open until the download starts</li>
              <li>Compile time matches your audio length</li>
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
            title={!canWebm ? 'MediaRecorder unavailable in this browser' : !hasAudio ? 'Upload audio first' : undefined}
          >
            <Video size={16} />
            <div>
              <strong>Video + Audio (WebM)</strong>
              <span>{canWebm ? `${diag.mrCodec.replace('video/', '')} · canvas + audio` : 'Not available'}</span>
            </div>
            <Download size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}

function DiagRow({ ok, label, note }: { ok: boolean; label: string; note?: string }) {
  return (
    <div className="export-diag-row">
      {ok ? <CheckCircle size={11} className="diag-ok" /> : <AlertCircle size={11} className="diag-warn" />}
      <span>{label}</span>
      {note && <em>{note}</em>}
    </div>
  )
}
