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

export const characterRegistry = new Map<string, CharacterProfile>([
  [
    'char-club',
    {
      id: 'char-club',
      label: 'Club Dancer',
      faceKitId: 'neon-raver',
      skinId: 'skinClub',
      outfitId: 'club-tee',
      defaultDanceId: 'shuffle',
      dancePool: ['shuffle', 'armWave', 'goofyTwoStep', 'bounce'],
      looseBias: 0.08,
      intensityBias: 0.12,
      triggerPreset: 'vivid',
    },
  ],
  [
    'char-street',
    {
      id: 'char-street',
      label: 'Street Dancer',
      faceKitId: 'street-chill',
      skinId: 'skinStreet',
      outfitId: 'street-hoodie',
      defaultDanceId: 'goofyTwoStep',
      dancePool: ['goofyTwoStep', 'shuffle', 'idle'],
      looseBias: 0.14,
      intensityBias: 0,
      triggerPreset: 'vivid',
    },
  ],
  [
    'char-evening',
    {
      id: 'char-evening',
      label: 'Evening Dancer',
      faceKitId: 'evening-glam',
      skinId: 'skinEvening',
      outfitId: 'evening-dress',
      defaultDanceId: 'leanGroove',
      dancePool: ['leanGroove', 'goofyTwoStep', 'idle'],
      looseBias: 0.1,
      intensityBias: -0.08,
      triggerPreset: 'tame',
    },
  ],
  [
    'char-blazer',
    {
      id: 'char-blazer',
      label: 'Blazer Dancer',
      faceKitId: 'sharp-classic',
      skinId: 'skinBlazer',
      outfitId: 'slim-blazer',
      defaultDanceId: 'robot',
      dancePool: ['robot', 'leanGroove', 'shuffle'],
      looseBias: -0.12,
      intensityBias: 0.05,
      triggerPreset: 'tame',
    },
  ],
  [
    'char-stage',
    {
      id: 'char-stage',
      label: 'Stage Dancer',
      faceKitId: 'stage-electric',
      skinId: 'skinStage',
      outfitId: 'stage-sparkle',
      defaultDanceId: 'armWave',
      dancePool: ['armWave', 'bounce', 'kickGroove', 'shuffle'],
      looseBias: 0.05,
      intensityBias: 0.18,
      triggerPreset: 'chaos',
    },
  ],
  [
    'char-robot',
    {
      id: 'char-robot',
      label: 'Robot Dancer',
      faceKitId: 'robot-chrome',
      skinId: 'skinRobot',
      outfitId: 'none',
      defaultDanceId: 'robot',
      dancePool: ['robot', 'mechanical'],
      looseBias: -0.2,
      intensityBias: 0,
      triggerPreset: 'tame',
    },
  ],
])

export function getCharacter(id: string): CharacterProfile {
  return characterRegistry.get(id) ?? characterRegistry.get('char-club')!
}

export function listCharacters(): Array<{ id: string; label: string }> {
  return [...characterRegistry.values()].map((c) => ({ id: c.id, label: c.label }))
}
