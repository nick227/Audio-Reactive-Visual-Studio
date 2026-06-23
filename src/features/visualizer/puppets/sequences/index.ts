import type { DanceMap } from '../poses/poseTypes'
import { bounceSequence, goofyTwoStepSequence, idleSequence, robotSequence } from './dances'
import {
  armWaveSequence,
  kickGrooveSequence,
  leanGrooveSequence,
  mechanicalSequence,
  shuffleSequence,
} from './dancesExtended'
import { buildDynamicRandomDance } from './dynamicRandom'

const danceRegistry = new Map<string, DanceMap>([
  [idleSequence.id, idleSequence],
  [bounceSequence.id, bounceSequence],
  [goofyTwoStepSequence.id, goofyTwoStepSequence],
  [robotSequence.id, robotSequence],
  [shuffleSequence.id, shuffleSequence],
  [armWaveSequence.id, armWaveSequence],
  [kickGrooveSequence.id, kickGrooveSequence],
  [leanGrooveSequence.id, leanGrooveSequence],
  [mechanicalSequence.id, mechanicalSequence],
])

export type DanceBias = { loose: number; intensity: number }

export function getDanceSequence(id: string, seed = Date.now(), bias?: DanceBias): DanceMap {
  if (id === 'dynamicRandom' || id.startsWith('dynamicRandom-')) {
    return buildDynamicRandomDance(seed)
  }
  const dance = danceRegistry.get(id) ?? idleSequence
  if (!bias) return dance
  return {
    ...dance,
    loose: Math.max(0.15, Math.min(0.95, dance.loose + bias.loose)),
    intensity: Math.max(0.4, Math.min(1.3, dance.intensity + bias.intensity)),
  }
}

export function listDances(): Array<{ id: string; label: string }> {
  const preset = [...danceRegistry.values()].map((d) => ({ id: d.id, label: d.label }))
  return [...preset, { id: 'dynamicRandom', label: 'Random Mix' }]
}

export function registerDance(dance: DanceMap) {
  danceRegistry.set(dance.id, dance)
}
