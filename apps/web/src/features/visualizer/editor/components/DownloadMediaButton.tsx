import { Download, Loader2, X } from 'lucide-react'

type DownloadMediaButtonProps = {
  hasAudio: boolean
  isExportingVideo: boolean
  progress: number
  onStart: () => void
  onCancel: () => void
}

export function DownloadMediaButton({ hasAudio, isExportingVideo, progress, onStart, onCancel }: DownloadMediaButtonProps) {
  const pct = Math.round(progress * 100)

  if (isExportingVideo) {
    return (
      <button className="dl-media-btn dl-media-btn--exporting" onClick={onCancel} title="Click to cancel">
        <div className="dl-media-fill" style={{ width: `${pct}%` }} />
        <Loader2 size={12} className="dl-media-spinner" />
        <span className="dl-media-label">Compiling... {pct}%</span>
        <X size={11} className="dl-media-cancel-icon" />
      </button>
    )
  }

  return (
    <button
      className="dl-media-btn"
      onClick={onStart}
      disabled={!hasAudio}
      title={hasAudio ? 'Download canvas + audio as WebM' : 'Add audio first'}
    >
      <Download size={12} />
      <span className="dl-media-label">Download Media</span>
    </button>
  )
}
