import type { SrtCue } from './parseSrt'
import { MAX_SRT_CUES } from './parseSrt'

export type LyricsConvertOptions = {
  /** Total track duration in ms; 0 = estimate from text length */
  durationMs: number
  minCueMs?: number
  maxCueMs?: number
  gapMs?: number
}

const DEFAULT_MIN_CUE_MS = 500
const DEFAULT_MAX_CUE_MS = 12_000
const DEFAULT_GAP_MS = 120
/** ~140 wpm spoken word, ~14 weighted chars/sec */
const CHARS_PER_SEC = 14
const MAX_LINE_CHARS = 72

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

/** Split raw lyrics into subtitle lines. */
export function splitLyricsLines(raw: string): string[] {
  const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
  if (!normalized) return []

  const paragraphs = normalized.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
  const lines: string[] = []

  for (const para of paragraphs) {
    const paraLines = para.split('\n').map((l) => l.trim()).filter(Boolean)
    if (paraLines.length > 1) {
      for (const line of paraLines) {
        lines.push(...(line.length > MAX_LINE_CHARS ? chunkLongText(line) : [line]))
      }
    } else {
      const text = paraLines[0] ?? para
      lines.push(...(text.length > MAX_LINE_CHARS ? chunkLongText(text) : [text]))
    }
  }
  return lines
}

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

function fitCuesToDuration(cues: SrtCue[], targetMs: number, gapMs: number): SrtCue[] {
  if (cues.length === 0 || targetMs <= 0) return cues
  const totalGaps = gapMs * Math.max(0, cues.length - 1)
  const contentMs = Math.max(cues.length * DEFAULT_MIN_CUE_MS, targetMs - totalGaps)
  const rawSpan = cues[cues.length - 1].endMs - cues[0].startMs - totalGaps
  if (rawSpan <= 0) return cues
  const scale = contentMs / rawSpan

  let cursor = 0
  return cues.map((cue, i) => {
    const dur = Math.round((cue.endMs - cue.startMs) * scale)
    const startMs = cursor
    const endMs = startMs + dur
    cursor = endMs + (i < cues.length - 1 ? gapMs : 0)
    return { ...cue, startMs, endMs, index: i + 1 }
  })
}

/**
 * Convert raw lyrics text into timed SRT cues.
 * Duration is distributed proportionally by character weight per line.
 */
export function lyricsToSrt(raw: string, options: LyricsConvertOptions): SrtCue[] {
  const lines = splitLyricsLines(raw)
  if (lines.length === 0) return []

  const minCueMs = options.minCueMs ?? DEFAULT_MIN_CUE_MS
  const maxCueMs = options.maxCueMs ?? DEFAULT_MAX_CUE_MS
  const gapMs = options.gapMs ?? DEFAULT_GAP_MS

  const weights = lines.map(charWeight)
  const totalWeight = weights.reduce((a, b) => a + b, 0)
  const totalGaps = gapMs * Math.max(0, lines.length - 1)

  let contentDurationMs: number
  if (options.durationMs > 0) {
    contentDurationMs = Math.max(lines.length * minCueMs, options.durationMs - totalGaps)
  } else {
    contentDurationMs = Math.round((totalWeight / CHARS_PER_SEC) * 1000)
  }

  const cues: SrtCue[] = []
  let cursor = 0

  for (let i = 0; i < lines.length; i++) {
    if (cues.length >= MAX_SRT_CUES) break

    let dur = Math.round((weights[i] / totalWeight) * contentDurationMs)
    dur = Math.max(minCueMs, Math.min(maxCueMs, dur))

    const startMs = cursor
    const endMs = startMs + dur
    cues.push({ index: i + 1, startMs, endMs, text: lines[i] })
    cursor = endMs + (i < lines.length - 1 ? gapMs : 0)
  }

  if (options.durationMs > 0) {
    return fitCuesToDuration(cues, options.durationMs, gapMs)
  }
  return cues
}
