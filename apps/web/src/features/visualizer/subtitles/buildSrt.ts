import { msToSrtTime } from './parseSrt'
import type { SrtCue } from './parseSrt'

/**
 * Serialise an array of SrtCues back to a valid .srt string.
 * Useful for future "export .srt" functionality.
 */
export function buildSrt(cues: SrtCue[]): string {
  return cues
    .slice()
    .sort((a, b) => a.startMs - b.startMs)
    .map((cue, i) => {
      const idx = i + 1
      const start = msToSrtTime(cue.startMs)
      const end = msToSrtTime(cue.endMs)
      return `${idx}\n${start} --> ${end}\n${cue.text}`
    })
    .join('\n\n')
}
