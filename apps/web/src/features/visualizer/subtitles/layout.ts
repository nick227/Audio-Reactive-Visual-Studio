export const DEFAULT_SUBTITLE_WIDTH = 76
export const MIN_SUBTITLE_WIDTH = 30
export const MAX_SUBTITLE_WIDTH = 95

export function clampSubtitleWidth(width: number): number {
  return Math.max(MIN_SUBTITLE_WIDTH, Math.min(MAX_SUBTITLE_WIDTH, Math.round(width)))
}

export function subtitleHandleInset(width: number): number {
  return (100 - clampSubtitleWidth(width)) / 2
}

export function wrapTextToWidth(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  if (maxWidth <= 0) return [text]

  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return ['']

  const lines: string[] = []
  let current = words[0]

  for (let i = 1; i < words.length; i += 1) {
    const next = `${current} ${words[i]}`
    if (ctx.measureText(next).width > maxWidth) {
      lines.push(current)
      current = words[i]
    } else {
      current = next
    }
  }

  lines.push(current)
  return lines
}
