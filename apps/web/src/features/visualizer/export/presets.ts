export type PresetId = 'draft' | 'standard' | 'high' | 'smooth'

export interface ExportPreset {
  id: PresetId
  label: string
  description: string
  fps: number
  bitrate: number
  /** Maximum output height in pixels. Canvas is scaled down to this height if the display is taller. */
  maxHeight: number
}

export const EXPORT_PRESETS: ExportPreset[] = [
  { id: 'draft',    label: 'Draft',    description: '720p · 24fps · 4 Mbps',   fps: 24, bitrate:  4_000_000, maxHeight: 720  },
  { id: 'standard', label: 'Standard', description: '1080p · 30fps · 8 Mbps',  fps: 30, bitrate:  8_000_000, maxHeight: 1080 },
  { id: 'high',     label: 'High',     description: '1080p · 30fps · 14 Mbps', fps: 30, bitrate: 14_000_000, maxHeight: 1080 },
  { id: 'smooth',   label: 'Smooth',   description: '1080p · 60fps · 18 Mbps', fps: 60, bitrate: 18_000_000, maxHeight: 1080 },
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
