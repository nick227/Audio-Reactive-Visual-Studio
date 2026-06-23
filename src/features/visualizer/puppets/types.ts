export type TriggerPreset = 'tame' | 'vivid' | 'chaos'

export type TriggerFrame = {
  beat: boolean
  bassHit: boolean
  midsHit: boolean
  highsHit: boolean
  chaosHit: boolean
  energy: number
  brightness: number
}

export type FaceState = {
  eyeOpen: number
  pupilX: number
  pupilY: number
  leftBrowLift: number
  rightBrowLift: number
  leftBrowRotate: number
  rightBrowRotate: number
  mouthOpen: number
  mouthSmile: number
  topLipY: number
  bottomLipY: number
  tongue: number
}

export type ResolvedPose = {
  angles: Record<string, number>
  offset: { x: number; y: number }
  scale: number
  face: FaceState
}

export type PuppetLayerSettings = {
  visualKind: 'puppet'
  characterId: string
  puppetId: string
  danceId: string
  skinId: string
  outfitId: string
  faceKitId: string
  autoDance: boolean
  showStage: boolean
  triggerPreset: TriggerPreset
  debug?: boolean
}

export type SolvedJoint = {
  x: number
  y: number
  angle: number
  radius: number
}

export const defaultFace = (): FaceState => ({
  eyeOpen: 1,
  pupilX: 0,
  pupilY: 0,
  leftBrowLift: 0,
  rightBrowLift: 0,
  leftBrowRotate: 0,
  rightBrowRotate: 0,
  mouthOpen: 0.08,
  mouthSmile: 0.12,
  topLipY: 0,
  bottomLipY: 0,
  tongue: 0,
})
