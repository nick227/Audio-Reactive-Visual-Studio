import { Pause, Play, Upload } from 'lucide-react'
import { Waveform } from '../Waveform'

type TransportPlayback = {
  isPlaying: boolean
  peaks: number[]
  progress: number
  togglePlayback: () => Promise<void>
  seek: (ratio: number) => void
  handleAudioFile: (file: File) => Promise<void>
}

type TransportBarProps = {
  hasAudio: boolean
  audioFilename?: string
  playback: TransportPlayback
}

export function TransportBar({ hasAudio, audioFilename, playback }: TransportBarProps) {
  return (
    <div className="transport">
      <button
        className="transport-play"
        onClick={() => void playback.togglePlayback()}
        disabled={!hasAudio}
        aria-label={playback.isPlaying ? 'Pause' : 'Play'}
      >
        {playback.isPlaying ? <Pause size={15} /> : <Play size={15} />}
      </button>
      <div className="transport-waveform">
        <Waveform peaks={playback.peaks} progress={playback.progress} onSeek={playback.seek} />
      </div>
      <label className="transport-audio-label" title={hasAudio ? audioFilename : 'Upload audio'}>
        <Upload size={13} />
        <span>{hasAudio ? audioFilename : 'Add Audio'}</span>
        <input
          type="file"
          accept="audio/*"
          hidden
          onChange={(e) => e.target.files?.[0] && void playback.handleAudioFile(e.target.files[0])}
        />
      </label>
    </div>
  )
}
