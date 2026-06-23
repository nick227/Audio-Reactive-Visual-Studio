export type SrtCue = {
  index: number
  startMs: number
  endMs: number
  text: string // \n-separated lines
}

const TIME_RE = /(\d{1,2}):(\d{2}):(\d{2})[,.](\d{3})/

function parseTimeMs(raw: string): number {
  const m = TIME_RE.exec(raw)
  if (!m) return 0
  const [, h, min, s, ms] = m
  return (
    parseInt(h) * 3_600_000 +
    parseInt(min) * 60_000 +
    parseInt(s) * 1_000 +
    parseInt(ms)
  )
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, '')
}

export const MAX_SRT_CUES = 5_000

/**
 * Parse a well-formed SRT string into an array of cues sorted by startMs.
 * Returns an empty array (never throws) on malformed input.
 */
export function parseSrt(raw: string): SrtCue[] {
  // Normalise line endings
  const text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
  // Split on blank lines separating blocks
  const blocks = text.split(/\n{2,}/)

  const cues: SrtCue[] = []

  for (const block of blocks) {
    if (cues.length >= MAX_SRT_CUES) break
    const lines = block.trim().split('\n')
    if (lines.length < 2) continue

    // First line may be the sequence number
    let offset = 0
    const maybeIndex = parseInt(lines[0])
    if (!isNaN(maybeIndex)) offset = 1

    const timeLine = lines[offset]
    if (!timeLine) continue

    const arrowIdx = timeLine.indexOf('-->')
    if (arrowIdx === -1) continue

    const startMs = parseTimeMs(timeLine.slice(0, arrowIdx))
    const endMs = parseTimeMs(timeLine.slice(arrowIdx + 3))

    if (endMs <= 0 && startMs === 0) continue // skip garbage

    const textLines = lines
      .slice(offset + 1)
      .map((l) => stripHtml(l).trim())
      .filter(Boolean)

    if (textLines.length === 0) continue

    cues.push({
      index: maybeIndex || cues.length + 1,
      startMs,
      endMs,
      text: textLines.join('\n'),
    })
  }

  return cues.sort((a, b) => a.startMs - b.startMs)
}

/** Binary-search the sorted cue array for the active cue at `ms`. O(log n). */
export function findActiveCue(cues: SrtCue[], ms: number): SrtCue | null {
  let lo = 0
  let hi = cues.length - 1

  while (lo <= hi) {
    const mid = (lo + hi) >>> 1
    const cue = cues[mid]
    if (ms < cue.startMs) {
      hi = mid - 1
    } else if (ms > cue.endMs) {
      lo = mid + 1
    } else {
      return cue
    }
  }
  return null
}

/** Format milliseconds as SRT timestamp: HH:MM:SS,mmm */
export function msToSrtTime(ms: number): string {
  const totalS = Math.floor(ms / 1000)
  const h = Math.floor(totalS / 3600)
  const min = Math.floor((totalS % 3600) / 60)
  const s = totalS % 60
  const msRem = ms % 1000
  return `${pad2(h)}:${pad2(min)}:${pad2(s)},${pad3(msRem)}`
}

/** Format milliseconds as compact display time: m:ss.s */
export function msToDisplay(ms: number): string {
  const totalS = ms / 1000
  const m = Math.floor(totalS / 60)
  const s = (totalS % 60).toFixed(1)
  return `${m}:${s.padStart(4, '0')}`
}

/** Parse a display-format string (m:ss.s or m:ss) back to ms */
export function displayToMs(display: string): number {
  const parts = display.trim().split(':')
  if (parts.length < 2) return 0
  const mins = parseFloat(parts[0]) || 0
  const secs = parseFloat(parts[1]) || 0
  return Math.round((mins * 60 + secs) * 1000)
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}
function pad3(n: number) {
  return String(n).padStart(3, '0')
}
