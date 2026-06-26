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

type ActiveStagePresetOptions = {
  isMobileDevice?: boolean
}

function isMobileDevice() {
  if (typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod|Mobi/i.test(navigator.userAgent)) {
    return true
  }

  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(max-width: 767px), (pointer: coarse) and (max-width: 1024px)').matches
}

export function getActiveStagePresetId(
  width: number,
  height: number,
  options: ActiveStagePresetOptions = {},
): StagePresetId {
  const matchingPreset = stagePresets.find((preset) => preset.width === width && preset.height === height)
  if (matchingPreset) return matchingPreset.id

  return (options.isMobileDevice ?? isMobileDevice()) ? 'mobile' : 'desktop'
}
