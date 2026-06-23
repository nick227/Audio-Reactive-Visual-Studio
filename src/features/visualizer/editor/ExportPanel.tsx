import { useMemo } from 'react'
import { AlertCircle, CheckCircle, Download, Image, Video, X } from 'lucide-react'

type Props = {
  hasAudio: boolean
  isExportingPng: boolean
  isExportingVideo: boolean
  videoProgress: number
  onExportPng: () => void
  onExportWebm: () => void
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
    ? (['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find(
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

export function ExportPanel({ hasAudio, isExportingPng, isExportingVideo, videoProgress, onExportPng, onExportWebm, onCancelVideo, onClose }: Props) {
  const diag = useMemo(() => getDiagnostics(), [])
  const canWebm = diag.mediaRecorder && diag.mrCodec !== 'none' && diag.mrCodec !== 'unavailable' && diag.captureStream
  const busy = isExportingPng || isExportingVideo

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="export-panel">
        <div className="export-panel-header">
          <span>Export</span>
          <button onClick={onClose}><X size={15} /></button>
        </div>

        <div className="export-actions">
          <button className="export-btn" onClick={onExportPng} disabled={busy}>
            <Image size={16} />
            <div>
              <strong>PNG Still</strong>
              <span>Current frame · full resolution</span>
            </div>
            {isExportingPng ? <span className="export-working">…</span> : <Download size={13} />}
          </button>

          <button
            className="export-btn"
            onClick={onExportWebm}
            disabled={!canWebm || !hasAudio || busy}
            title={!canWebm ? 'MediaRecorder unavailable in this browser' : !hasAudio ? 'Upload audio first' : undefined}
          >
            <Video size={16} />
            <div>
              <strong>Preview WebM</strong>
              <span>{canWebm ? diag.mrCodec.replace('video/', '') : 'Not available'}</span>
            </div>
            {!isExportingVideo && <Download size={13} />}
          </button>

          {isExportingVideo && (
            <div className="export-progress-wrap">
              <div className="export-progress-bar">
                <div style={{ width: `${Math.round(videoProgress * 100)}%` }} />
              </div>
              <span>{Math.round(videoProgress * 100)}%</span>
              <button className="export-cancel-btn" onClick={onCancelVideo}>Cancel</button>
            </div>
          )}
        </div>

        <div className="export-diag">
          <p className="export-diag-title">Browser capabilities</p>
          <DiagRow ok={diag.mediaRecorder} label="MediaRecorder" note={diag.mrCodec !== 'unavailable' ? diag.mrCodec.replace('video/', '') : undefined} />
          <DiagRow ok={diag.captureStream} label="canvas.captureStream()" />
          <DiagRow ok={diag.videoEncoder} label="VideoEncoder (WebCodecs)" />
          <DiagRow ok={diag.crossOriginIsolated} label="crossOriginIsolated" />
          <DiagRow ok={diag.sharedArrayBuffer} label="SharedArrayBuffer" />
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
