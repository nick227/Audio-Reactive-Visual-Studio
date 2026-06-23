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

export const faceKits = new Map<string, FaceKit>([
  [
    'neon-raver',
    {
      id: 'neon-raver',
      label: 'Neon Raver',
      style: 'human',
      eyeSpacing: 1.12,
      eyeScale: 1.15,
      headScale: 1.04,
      browStyle: 'sharp',
      mouthStyle: 'wide',
      cheekAlpha: 0.28,
      defaultExpression: { eyeOpen: 1, mouthSmile: 0.35, mouthOpen: 0.12, leftBrowLift: 0.15, rightBrowLift: 0.15 },
    },
  ],
  [
    'street-chill',
    {
      id: 'street-chill',
      label: 'Street Chill',
      style: 'human',
      eyeSpacing: 0.94,
      eyeScale: 0.92,
      headScale: 1,
      browStyle: 'flat',
      mouthStyle: 'smirk',
      cheekAlpha: 0.12,
      defaultExpression: { eyeOpen: 0.82, mouthSmile: 0.22, mouthOpen: 0.05, pupilX: 0.08 },
    },
  ],
  [
    'evening-glam',
    {
      id: 'evening-glam',
      label: 'Evening Glam',
      style: 'human',
      eyeSpacing: 1.05,
      eyeScale: 1.08,
      headScale: 1.02,
      browStyle: 'arc',
      mouthStyle: 'small',
      cheekAlpha: 0.22,
      defaultExpression: { eyeOpen: 0.95, mouthSmile: 0.18, mouthOpen: 0.06, leftBrowLift: 0.2, rightBrowLift: 0.22 },
    },
  ],
  [
    'sharp-classic',
    {
      id: 'sharp-classic',
      label: 'Sharp Classic',
      style: 'human',
      eyeSpacing: 0.98,
      eyeScale: 0.96,
      headScale: 0.98,
      browStyle: 'sharp',
      mouthStyle: 'smirk',
      cheekAlpha: 0.08,
      defaultExpression: { eyeOpen: 0.88, mouthSmile: 0.08, mouthOpen: 0.04, leftBrowRotate: -0.1, rightBrowRotate: 0.1 },
    },
  ],
  [
    'stage-electric',
    {
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
    },
  ],
  [
    'robot-chrome',
    {
      id: 'robot-chrome',
      label: 'Robot Chrome',
      style: 'robot',
      eyeSpacing: 1.2,
      eyeScale: 1,
      headScale: 1.05,
      browStyle: 'none',
      mouthStyle: 'line',
      cheekAlpha: 0,
      defaultExpression: { eyeOpen: 1, mouthOpen: 0, mouthSmile: 0, pupilX: 0 },
    },
  ],
])

export function getFaceKit(id: string): FaceKit {
  return faceKits.get(id) ?? faceKits.get('neon-raver')!
}
