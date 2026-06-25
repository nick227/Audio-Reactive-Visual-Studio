export type PresetId = 'draft' | 'standard' | 'high' | 'smooth'
export type ExportVideoCodec = 'vp8' | 'vp9' | 'auto'

export interface ExportPreset {
  id: PresetId
  label: string
  description: string
  fps: number
  bitrate: number
  videoCodec: ExportVideoCodec
  maxVideoEncodeQueueSize: number
  /** Maximum output height in pixels. Canvas is scaled down to this height if the display is taller. */
  maxHeight: number
}

export const EXPORT_PRESETS: ExportPreset[] = [
  {
    id: 'draft',
    label: 'Draft Fast',
    description: '720p · 24fps · 2.5 Mbps · VP8 when available',
    fps: 24,
    bitrate: 2_500_000,
    videoCodec: 'vp8',
    maxVideoEncodeQueueSize: 6,
    maxHeight: 720,
  },
  {
    id: 'standard',
    label: 'Standard',
    description: '1080p cap · 30fps · 5 Mbps · VP9',
    fps: 30,
    bitrate: 5_000_000,
    videoCodec: 'vp9',
    maxVideoEncodeQueueSize: 10,
    maxHeight: 1080,
  },
  {
    id: 'high',
    label: 'High',
    description: '1080p · 30fps · 11 Mbps · VP9',
    fps: 30,
    bitrate: 11_000_000,
    videoCodec: 'vp9',
    maxVideoEncodeQueueSize: 12,
    maxHeight: 1080,
  },
  {
    id: 'smooth',
    label: 'Smooth',
    description: '1080p · 60fps · 14 Mbps · VP9 · slow',
    fps: 60,
    bitrate: 14_000_000,
    videoCodec: 'vp9',
    maxVideoEncodeQueueSize: 12,
    maxHeight: 1080,
  },
]

export const DEFAULT_PRESET_ID: PresetId = 'standard'

export function getPreset(id: PresetId): ExportPreset {
  return EXPORT_PRESETS.find((p) => p.id === id) ?? EXPORT_PRESETS[1]
}

/** Scale the output canvas down to the preset's maxHeight, preserving aspect ratio. */
export function computeOutputSize(
  displayW: number,
  displayH: number,
  preset: ExportPreset,
): { w: number; h: number } {
  if (displayH <= preset.maxHeight) return { w: displayW, h: displayH }
  const scale = preset.maxHeight / displayH
  return { w: Math.round(displayW * scale), h: preset.maxHeight }
}
