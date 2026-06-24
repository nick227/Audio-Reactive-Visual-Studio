import { findActiveCue } from '../subtitles/parseSrt'
import type { SrtCue } from '../subtitles/parseSrt'
import type { LayerInstance } from '../project/types'

type Props = {
  layer: LayerInstance
  currentTimeMs: number
}

export function SubtitleLayer({ layer, currentTimeMs }: Props) {
  const cues = (layer.settings.cues ?? []) as SrtCue[]
  const activeCue = findActiveCue(cues, currentTimeMs)

  const style = String(layer.settings.subtitleStyle ?? 'cinematic')
  const color = String(layer.settings.color ?? '#ffffff')
  const fontSize = Number(layer.settings.fontSize ?? 48)

  const cssVars = { color, fontSize } as React.CSSProperties

  if (!activeCue) return null

  return (
    <div className={`subtitle-layer subtitle-style-${style}`} style={cssVars} aria-live="polite">
      {activeCue.text.split('\n').map((line, i) => (
        <span key={i} className="subtitle-line">{line}</span>
      ))}
    </div>
  )
}
