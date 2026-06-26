import { Clapperboard, Monitor, Smartphone } from 'lucide-react'
import type { StagePresetId } from '../../project/types'

export const stagePresets: Array<{
  id: StagePresetId
  label: string
  icon: typeof Smartphone
  width: number
  height: number
}> = [
  { id: 'mobile', label: 'Mobile', icon: Smartphone, width: 1080, height: 1920 },
  { id: 'desktop', label: 'Desktop', icon: Monitor, width: 1920, height: 1080 },
  { id: 'film', label: 'Film', icon: Clapperboard, width: 2048, height: 858 },
]

export function getActiveStagePresetId(width: number, height: number): StagePresetId {
  return stagePresets.find((preset) => preset.width === width && preset.height === height)?.id ?? 'desktop'
}
