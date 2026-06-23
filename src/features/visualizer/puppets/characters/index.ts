import type { TriggerPreset } from '../types'

export type CharacterProfile = {
  id: string
  label: string
  faceKitId: string
  skinId: string
  outfitId: string
  defaultDanceId: string
  dancePool: string[]
  looseBias: number
  intensityBias: number
  triggerPreset: TriggerPreset
}

export const defaultCharacter: CharacterProfile = {
  id: 'char-dancer',
  label: 'Puppet Dancer',
  faceKitId: 'stage-electric',
  skinId: 'skinStage',
  outfitId: 'stage-sparkle',
  defaultDanceId: 'armWave',
  dancePool: ['armWave', 'shuffle', 'kickGroove', 'goofyTwoStep', 'bounce', 'leanGroove'],
  looseBias: 0.06,
  intensityBias: 0.14,
  triggerPreset: 'vivid',
}

export function getCharacter(_id?: string): CharacterProfile {
  return defaultCharacter
}
