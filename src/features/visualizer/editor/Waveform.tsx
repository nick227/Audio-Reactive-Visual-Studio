type Props = {
  peaks: number[]
  progress: number
  onSeek: (ratio: number) => void
}

export function Waveform({ peaks, progress, onSeek }: Props) {
  return (
    <div
      className="waveform"
      onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect()
        onSeek((event.clientX - rect.left) / rect.width)
      }}
    >
      <div className="waveform-bars">
        {peaks.map((peak, i) => (
          <span key={i} style={{ height: `${Math.max(8, peak * 64)}px`, opacity: i / peaks.length <= progress ? 1 : 0.28 }} />
        ))}
      </div>
      <i className="playhead" style={{ left: `${progress * 100}%` }} />
    </div>
  )
}
