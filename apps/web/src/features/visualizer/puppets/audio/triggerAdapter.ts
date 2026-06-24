import type { AudioFeatures } from '../../audio/audioTypes'
import type { TriggerFrame, TriggerPreset } from '../types'

const PRESETS: Record<TriggerPreset, { beat: number; bass: number; mids: number; highs: number; chaos: number }> = {
  tame: { beat: 0.72, bass: 0.68, mids: 0.65, highs: 0.62, chaos: 0.92 },
  vivid: { beat: 0.58, bass: 0.52, mids: 0.5, highs: 0.48, chaos: 0.78 },
  chaos: { beat: 0.42, bass: 0.38, mids: 0.36, highs: 0.34, chaos: 0.55 },
}

type ScalarTriggerKey = 'beat' | 'bass' | 'mids' | 'highs'

function crossed(value: number, prev: number, threshold: number) {
  return value >= threshold && prev < threshold
}

export function audioFeaturesToTriggerFrame(
  features: AudioFeatures,
  prevScalars: Record<ScalarTriggerKey, number>,
  preset: TriggerPreset,
): TriggerFrame {
  const t = PRESETS[preset]
  return {
    beat: crossed(features.beat, prevScalars.beat, t.beat),
    bassHit: crossed(features.bass, prevScalars.bass, t.bass),
    midsHit: crossed(features.vocals, prevScalars.mids, t.mids),
    highsHit: crossed(features.highs, prevScalars.highs, t.highs),
    chaosHit: features.full > t.chaos,
    energy: features.full,
    brightness: features.highs,
  }
}

export function silentTriggerFrame(): TriggerFrame {
  return {
    beat: false,
    bassHit: false,
    midsHit: false,
    highsHit: false,
    chaosHit: false,
    energy: 0,
    brightness: 0,
  }
}

export class TriggerEdgeStore {
  private readonly scalars = new Map<string, Record<ScalarTriggerKey, number>>()

  toTriggerFrame(layerId: string, features: AudioFeatures, preset: TriggerPreset): TriggerFrame {
    const prevScalars = this.scalars.get(layerId) ?? { beat: 0, bass: 0, mids: 0, highs: 0 }
    const frame = audioFeaturesToTriggerFrame(features, prevScalars, preset)
    this.scalars.set(layerId, {
      beat: features.beat,
      bass: features.bass,
      mids: features.vocals,
      highs: features.highs,
    })
    return frame
  }

  clear(layerId: string) {
    this.scalars.delete(layerId)
  }
}
