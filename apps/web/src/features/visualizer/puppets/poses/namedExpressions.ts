import type { FaceState } from '../types'

export const namedExpressions: Record<string, Partial<FaceState>> = {
  browFlash: {
    leftBrowLift: 0.55,
    rightBrowLift: 0.55,
    eyeOpen: 1,
  },
  wideEyes: {
    eyeOpen: 1,
    pupilY: -0.22,
    leftBrowLift: 0.35,
    rightBrowLift: 0.35,
  },
  jawDrop: {
    mouthOpen: 0.58,
    topLipY: -0.18,
    bottomLipY: 0.12,
  },
  bigGrin: {
    mouthSmile: 0.72,
    mouthOpen: 0.18,
    leftBrowLift: 0.2,
    rightBrowLift: 0.2,
  },
  oFace: {
    mouthOpen: 0.78,
    mouthSmile: 0,
    eyeOpen: 1,
    pupilY: 0.08,
  },
  sideEye: {
    pupilX: 0.5,
    leftBrowLift: 0.28,
    rightBrowRotate: -0.25,
    mouthSmile: 0.08,
  },
  smirk: {
    mouthSmile: 0.45,
    mouthOpen: 0.06,
    rightBrowLift: 0.15,
    pupilX: 0.18,
  },
  bassWink: {
    eyeOpen: 0.35,
    mouthOpen: 0.22,
    mouthSmile: 0.25,
    pupilX: -0.15,
  },
}

export function mergeFaceState(base: FaceState, patch: Partial<FaceState>, amount: number): FaceState {
  const next = { ...base }
  for (const [key, value] of Object.entries(patch) as Array<[keyof FaceState, number]>) {
    next[key] = base[key] + (value - base[key]) * amount
  }
  return next
}
