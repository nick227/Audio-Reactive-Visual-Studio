import type { FaceState } from '../types'

export type FaceStyle = 'human' | 'robot'
export type BrowStyle = 'arc' | 'flat' | 'sharp' | 'none'
export type MouthStyle = 'round' | 'smirk' | 'wide' | 'line' | 'small'

export type FaceKit = {
  id: string
  label: string
  style: FaceStyle
  eyeSpacing: number
  eyeScale: number
  headScale: number
  browStyle: BrowStyle
  mouthStyle: MouthStyle
  cheekAlpha: number
  defaultExpression: Partial<FaceState>
}

export const stageElectricFace: FaceKit = {
  id: 'stage-electric',
  label: 'Stage Electric',
  style: 'human',
  eyeSpacing: 1.08,
  eyeScale: 1.1,
  headScale: 1.06,
  browStyle: 'arc',
  mouthStyle: 'wide',
  cheekAlpha: 0.2,
  defaultExpression: { eyeOpen: 1, mouthSmile: 0.42, mouthOpen: 0.2, pupilY: -0.05 },
}

export function getFaceKit(_id?: string): FaceKit {
  return stageElectricFace
}
