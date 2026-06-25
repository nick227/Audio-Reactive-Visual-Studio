import { findActiveCue } from '../subtitles/parseSrt'
import type { SrtCue } from '../subtitles/parseSrt'
import { DEFAULT_SUBTITLE_WIDTH } from '../subtitles/layout'
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
  const offsetY = Number(layer.settings.subtitleOffsetY ?? 10)
  const subtitleWidth = Number(layer.settings.subtitleWidth ?? DEFAULT_SUBTITLE_WIDTH)
  const position = offsetY >= 65 ? 'top' : offsetY >= 30 ? 'middle' : 'bottom'

  const cssVars = {
    color,
    fontSize,
    '--subtitle-offset-y': `${offsetY}%`,
    '--subtitle-width': `${subtitleWidth}%`,
  } as React.CSSProperties & Record<'--subtitle-offset-y' | '--subtitle-width', string>

  if (!activeCue) return null

  return (
    <div className={`subtitle-layer subtitle-style-${style} subtitle-pos-${position}`} style={cssVars} aria-live="polite">
      <div className="subtitle-cue">
        <div className="subtitle-cue-inner">
          {activeCue.text.split('\n').map((line, i) => (
            <span key={i} className="subtitle-line">{line}</span>
          ))}
        </div>
      </div>
    </div>
  )
}
