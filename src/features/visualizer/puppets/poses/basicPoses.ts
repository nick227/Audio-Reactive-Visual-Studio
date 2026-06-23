import type { PuppetPoseMap } from './poseTypes'

export const idlePose: PuppetPoseMap = {
  id: 'idle',
  label: 'Idle',
  rotations: {
    hips: 2,
    leftKnee: 98,
    rightKnee: 88,
    leftElbow: -108,
    rightElbow: -72,
  },
  offset: { x: 0, y: 0 },
  scale: 1,
  face: { mouthOpen: 0.06, mouthSmile: 0.1 },
}

export const bouncePose: PuppetPoseMap = {
  id: 'bounce',
  label: 'Bounce',
  rotations: { hips: -6, leftKnee: 118, rightKnee: 72, spine: -88, chest: -86 },
  offset: { x: 0, y: 10 },
  scale: 1.04,
  face: { mouthOpen: 0.28, mouthSmile: 0.2 },
}

export const leftStepPose: PuppetPoseMap = {
  id: 'leftStep',
  label: 'Left Step',
  rotations: { hips: -8, leftKnee: 72, rightKnee: 108, leftAnkle: 96, rightAnkle: 88, leftElbow: -95, rightElbow: -78 },
  offset: { x: -10, y: 4 },
  scale: 1,
}

export const rightStepPose: PuppetPoseMap = {
  id: 'rightStep',
  label: 'Right Step',
  rotations: { hips: 8, rightKnee: 72, leftKnee: 108, rightAnkle: 96, leftAnkle: 88, leftElbow: -78, rightElbow: -95 },
  offset: { x: 10, y: 4 },
  scale: 1,
}

export const robotPose: PuppetPoseMap = {
  id: 'robot',
  label: 'Robot',
  rotations: { leftShoulder: -170, rightShoulder: -10, leftElbow: -60, rightElbow: -120, leftWrist: -60, rightWrist: -120, hips: 0, leftKnee: 90, rightKnee: 90 },
  offset: { x: 0, y: 2 },
  scale: 1,
  face: { mouthOpen: 0, mouthSmile: 0, eyeOpen: 0.85 },
}

export const armsUpPose: PuppetPoseMap = {
  id: 'armsUp',
  label: 'Arms Up',
  rotations: {
    leftShoulder: -175, rightShoulder: -5, leftElbow: -130, rightElbow: -50,
    leftWrist: -110, rightWrist: -70, hips: -4, spine: -88,
  },
  offset: { x: 0, y: 6 },
  scale: 1.03,
  face: { mouthOpen: 0.35, mouthSmile: 0.4, eyeOpen: 1 },
}

export const waveLeftPose: PuppetPoseMap = {
  id: 'waveLeft',
  label: 'Wave Left',
  rotations: {
    leftShoulder: -165, leftElbow: -45, leftWrist: -30,
    rightShoulder: -40, rightElbow: -75, hips: 4,
  },
  offset: { x: -6, y: 4 },
  face: { mouthSmile: 0.45, mouthOpen: 0.15 },
}

export const waveRightPose: PuppetPoseMap = {
  id: 'waveRight',
  label: 'Wave Right',
  rotations: {
    rightShoulder: -15, rightElbow: -45, rightWrist: -30,
    leftShoulder: -140, leftElbow: -100, hips: -4,
  },
  offset: { x: 6, y: 4 },
  face: { mouthSmile: 0.45, mouthOpen: 0.15 },
}

export const kickLeftPose: PuppetPoseMap = {
  id: 'kickLeft',
  label: 'Kick Left',
  rotations: {
    leftHip: 95, leftKnee: 55, leftAnkle: 70,
    rightKnee: 105, rightAnkle: 92, hips: -10,
    leftShoulder: -150, rightShoulder: -30,
  },
  offset: { x: -12, y: 2 },
  scale: 1.02,
  face: { mouthOpen: 0.3, eyeOpen: 1 },
}

export const leanBackPose: PuppetPoseMap = {
  id: 'leanBack',
  label: 'Lean Back',
  rotations: {
    hips: 12, spine: -78, chest: -76, neck: -74, head: -72,
    leftKnee: 115, rightKnee: 100,
    leftElbow: -100, rightElbow: -80,
  },
  offset: { x: 0, y: -4 },
  face: { mouthSmile: 0.25, eyeOpen: 0.9, pupilY: -0.1 },
}

export const jazzHandsPose: PuppetPoseMap = {
  id: 'jazzHands',
  label: 'Jazz Hands',
  rotations: {
    leftShoulder: -175, rightShoulder: -5,
    leftElbow: -55, rightElbow: -125,
    leftWrist: -40, rightWrist: -140,
    hips: -6, leftKnee: 108, rightKnee: 95,
  },
  offset: { x: 0, y: 8 },
  scale: 1.05,
  face: { mouthOpen: 0.4, mouthSmile: 0.55, eyeOpen: 1 },
}

export const basicPoses = {
  idle: idlePose,
  bounce: bouncePose,
  leftStep: leftStepPose,
  rightStep: rightStepPose,
  robot: robotPose,
  armsUp: armsUpPose,
  waveLeft: waveLeftPose,
  waveRight: waveRightPose,
  kickLeft: kickLeftPose,
  leanBack: leanBackPose,
  jazzHands: jazzHandsPose,
}
