import type { SrtCue } from './parseSrt'
import { MAX_SRT_CUES } from './parseSrt'

export type LyricsConvertOptions = {
  /** Total track duration in ms; 0 = estimate from text length */
  durationMs: number
  minCueMs?: number
  maxCueMs?: number
  gapMs?: number
}

export type LyricSegment =
  | { type: 'line'; text: string }
  | { type: 'pause'; ms: number }

const DEFAULT_MIN_CUE_MS = 500
const DEFAULT_MAX_CUE_MS = 12_000
const DEFAULT_GAP_MS = 120
/** ~140 wpm spoken word, ~14 weighted chars/sec */
const CHARS_PER_SEC = 14
const MAX_LINE_CHARS = 72

/**
 * Gaps smaller than this (between consecutive cues) are considered natural
 * breathing room and are NOT emitted as (Xs) markers in srtToLyrics.
 */
const GAP_EMIT_THRESHOLD_MS = 500

function chunkLongText(text: string, maxLen = MAX_LINE_CHARS): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((s) => s.trim()).filter(Boolean) ?? [text]
  const chunks: string[] = []
  let current = ''

  const flush = () => {
    if (current.trim()) chunks.push(current.trim())
    current = ''
  }

  const wrapWords = (sentence: string) => {
    const words = sentence.split(/\s+/)
    let line = ''
    for (const word of words) {
      const next = line ? `${line} ${word}` : word
      if (next.length > maxLen && line) {
        chunks.push(line)
        line = word
      } else {
        line = next
      }
    }
    if (line) chunks.push(line)
  }

  for (const sentence of sentences) {
    if (sentence.length > maxLen) {
      flush()
      wrapWords(sentence)
      continue
    }
    const combined = current ? `${current} ${sentence}` : sentence
    if (combined.length > maxLen && current) {
      flush()
      current = sentence
    } else {
      current = combined
    }
  }
  flush()
  return chunks
}

// ─── Pause marker parsing ─────────────────────────────────────────────────────
//
// Supported formats (case-insensitive, whitespace-flexible):
//   (5s)   (0.5s)   (1m)   (1m30s)   (1m30.5s)
//
const PAUSE_RE = /^\(\s*(?:(\d+(?:\.\d+)?)\s*m)?\s*(?:(\d+(?:\.\d+)?)\s*s)?\s*\)$/i

/** Returns pause duration in ms, or null if line is not a pause marker. */
export function parsePauseMarker(line: string): number | null {
  const m = PAUSE_RE.exec(line.trim())
  if (!m) return null
  const mins = parseFloat(m[1] ?? '0') || 0
  const secs = parseFloat(m[2] ?? '0') || 0
  if (mins === 0 && secs === 0) return null
  return Math.round((mins * 60 + secs) * 1000)
}

/** Format a duration in ms as a human-readable pause marker string (without parens). */
function formatPauseMs(ms: number): string {
  const totalSec = ms / 1000
  const mins = Math.floor(totalSec / 60)
  const secs = Math.round((totalSec % 60) * 10) / 10
  if (mins > 0) return secs > 0 ? `${mins}m${secs}s` : `${mins}m`
  return `${secs}s`
}

// ─── Segment splitter ─────────────────────────────────────────────────────────

/**
 * Split raw lyrics into timed segments.
 *
 * Lines matching the (Xs) / (1m30s) pattern become pause segments.
 * Blank lines are ignored (no longer treated as pauses).
 */
export function splitLyricsSegments(raw: string): LyricSegment[] {
  const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const segments: LyricSegment[] = []

  for (const line of normalized.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const pauseMs = parsePauseMarker(trimmed)
    if (pauseMs !== null) {
      // Merge adjacent pauses
      const last = segments[segments.length - 1]
      if (last?.type === 'pause') {
        last.ms += pauseMs
      } else {
        segments.push({ type: 'pause', ms: pauseMs })
      }
    } else {
      const chunks = trimmed.length > MAX_LINE_CHARS ? chunkLongText(trimmed) : [trimmed]
      for (const chunk of chunks) {
        segments.push({ type: 'line', text: chunk })
      }
    }
  }

  // Trim leading/trailing pauses
  while (segments.length && segments[0].type === 'pause') segments.shift()
  while (segments.length && segments[segments.length - 1].type === 'pause') segments.pop()

  return segments
}

// ─── Weight ───────────────────────────────────────────────────────────────────

/** Weight characters for spoken-word pacing (letters > spaces > punctuation). */
export function charWeight(text: string): number {
  let w = 0
  for (const ch of text) {
    if (/[a-zA-Z0-9]/.test(ch)) w += 1
    else if (/\s/.test(ch)) w += 0.35
    else w += 0.2
  }
  return Math.max(1, w)
}

// ─── Lyrics → SRT ────────────────────────────────────────────────────────────

/**
 * Convert raw lyrics text into timed SRT cues.
 *
 * Use (Xs) / (1m30s) markers to insert explicit pauses.
 * Duration is distributed proportionally by character weight per line.
 */
export function lyricsToSrt(raw: string, options: LyricsConvertOptions): SrtCue[] {
  const segments = splitLyricsSegments(raw)
  const lineSegments = segments.filter((s): s is { type: 'line'; text: string } => s.type === 'line')
  if (lineSegments.length === 0) return []

  const minCueMs = options.minCueMs ?? DEFAULT_MIN_CUE_MS
  const maxCueMs = options.maxCueMs ?? DEFAULT_MAX_CUE_MS
  const gapMs = options.gapMs ?? DEFAULT_GAP_MS

  const explicitPauseMs = segments
    .filter((s): s is { type: 'pause'; ms: number } => s.type === 'pause')
    .reduce((sum, s) => sum + s.ms, 0)

  const weights = lineSegments.map((s) => charWeight(s.text))
  const totalWeight = weights.reduce((a, b) => a + b, 0)
  const totalGaps = gapMs * Math.max(0, lineSegments.length - 1)

  let contentDurationMs: number
  if (options.durationMs > 0) {
    contentDurationMs = Math.max(
      lineSegments.length * minCueMs,
      options.durationMs - totalGaps - explicitPauseMs,
    )
  } else {
    contentDurationMs = Math.round((totalWeight / CHARS_PER_SEC) * 1000)
  }

  const cues: SrtCue[] = []
  let cursor = 0
  let lineIdx = 0

  for (const segment of segments) {
    if (cues.length >= MAX_SRT_CUES) break

    if (segment.type === 'pause') {
      cursor += segment.ms
    } else {
      const weight = weights[lineIdx]
      let dur = Math.round((weight / totalWeight) * contentDurationMs)
      dur = Math.max(minCueMs, Math.min(maxCueMs, dur))

      cues.push({ index: cues.length + 1, startMs: cursor, endMs: cursor + dur, text: segment.text })
      cursor += dur + (lineIdx < lineSegments.length - 1 ? gapMs : 0)
      lineIdx++
    }
  }

  return cues
}

// ─── SRT → Lyrics ────────────────────────────────────────────────────────────

/**
 * Convert SrtCue[] back to a human-editable lyrics string.
 *
 * Significant gaps between cues (≥ 500ms) are expressed as (Xs) pause markers.
 * A leading offset (if the first cue doesn't start at 0) is also emitted.
 * Multi-line cue text is joined with a space.
 */
export function srtToLyrics(cues: SrtCue[]): string {
  if (cues.length === 0) return ''

  const lines: string[] = []

  // Leading offset
  if (cues[0].startMs >= GAP_EMIT_THRESHOLD_MS) {
    lines.push(`(${formatPauseMs(cues[0].startMs)})`)
  }

  for (let i = 0; i < cues.length; i++) {
    // Multi-line cue text → join with space for lyrics format
    lines.push(cues[i].text.replace(/\n/g, ' '))

    if (i < cues.length - 1) {
      const gapMs = cues[i + 1].startMs - cues[i].endMs
      if (gapMs >= GAP_EMIT_THRESHOLD_MS) {
        lines.push(`(${formatPauseMs(gapMs)})`)
      }
    }
  }

  return lines.join('\n')
}
