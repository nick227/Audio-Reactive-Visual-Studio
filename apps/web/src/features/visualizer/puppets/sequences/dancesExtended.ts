import type { DanceMap } from '../poses/poseTypes'
import { basicPoses } from '../poses/basicPoses'

export const shuffleSequence: DanceMap = {
  schemaVersion: 1,
  id: 'shuffle',
  label: 'Shuffle',
  loop: true,
  intensity: 0.95,
  loose: 0.78,
  poses: {
    idle: basicPoses.idle,
    leftStep: basicPoses.leftStep,
    rightStep: basicPoses.rightStep,
    bounce: basicPoses.bounce,
    leanBack: basicPoses.leanBack,
  },
  triggerAccents: {
    beat: ['hipBounce', 'bigGrin'],
    bassHit: ['kneeDip'],
    highsHit: ['armWave'],
  },
  steps: [
    { pose: 'leftStep', durationMs: 280, ease: 'easeInOut', beatSnap: true },
    { pose: 'bounce', durationMs: 160, ease: 'snap' },
    { pose: 'rightStep', durationMs: 280, ease: 'easeInOut', advanceOn: 'beat' },
    { pose: 'leanBack', durationMs: 320, ease: 'easeOutBack', accents: ['headNod'] },
    { pose: 'bounce', durationMs: 180, ease: 'elasticOut', advanceOn: 'bassHit' },
  ],
}

export const armWaveSequence: DanceMap = {
  schemaVersion: 1,
  id: 'armWave',
  label: 'Arm Wave',
  loop: true,
  intensity: 1.05,
  loose: 0.65,
  poses: {
    idle: basicPoses.idle,
    waveLeft: basicPoses.waveLeft,
    waveRight: basicPoses.waveRight,
    armsUp: basicPoses.armsUp,
    jazzHands: basicPoses.jazzHands,
    bounce: basicPoses.bounce,
  },
  triggerAccents: {
    beat: ['armWave', 'browFlash'],
    bassHit: ['hipBounce'],
    highsHit: ['wideEyes', 'bigGrin'],
    chaosHit: ['oFace'],
  },
  steps: [
    { pose: 'waveLeft', durationMs: 300, ease: 'easeInOut', beatSnap: true },
    { pose: 'armsUp', durationMs: 220, ease: 'easeOutBack', accents: ['bigGrin'] },
    { pose: 'waveRight', durationMs: 300, ease: 'easeInOut', advanceOn: 'beat' },
    { pose: 'jazzHands', durationMs: 260, ease: 'elasticOut', beatSnap: true },
    { pose: 'bounce', durationMs: 200, ease: 'snap', advanceOn: 'bassHit' },
  ],
}

export const kickGrooveSequence: DanceMap = {
  schemaVersion: 1,
  id: 'kickGroove',
  label: 'Kick Groove',
  loop: true,
  intensity: 1.1,
  loose: 0.72,
  poses: {
    idle: basicPoses.idle,
    kickLeft: basicPoses.kickLeft,
    bounce: basicPoses.bounce,
    leftStep: basicPoses.leftStep,
    rightStep: basicPoses.rightStep,
  },
  triggerAccents: {
    beat: ['hipBounce', 'kneeDip'],
    bassHit: ['jawDrop'],
    chaosHit: ['armWave'],
  },
  steps: [
    { pose: 'kickLeft', durationMs: 320, ease: 'easeOutBack', beatSnap: true },
    { pose: 'bounce', durationMs: 180, ease: 'snap' },
    { pose: 'rightStep', durationMs: 280, ease: 'easeInOut', advanceOn: 'bassHit' },
    { pose: 'kickLeft', durationMs: 280, ease: 'easeInOut', accents: ['kneeDip'] },
    { pose: 'leftStep', durationMs: 260, ease: 'easeInOut', advanceOn: 'beat' },
  ],
}

export const leanGrooveSequence: DanceMap = {
  schemaVersion: 1,
  id: 'leanGroove',
  label: 'Lean Groove',
  loop: true,
  intensity: 0.8,
  loose: 0.85,
  poses: {
    idle: basicPoses.idle,
    leanBack: basicPoses.leanBack,
    leftStep: basicPoses.leftStep,
    rightStep: basicPoses.rightStep,
    bounce: { ...basicPoses.bounce, scale: 0.98 },
  },
  triggerAccents: {
    beat: ['smirk'],
    bassHit: ['kneeDip'],
    midsHit: ['sideEye'],
  },
  steps: [
    { pose: 'leanBack', durationMs: 480, ease: 'easeInOut', beatSnap: true },
    { pose: 'leftStep', durationMs: 360, ease: 'easeInOut' },
    { pose: 'leanBack', durationMs: 400, ease: 'easeOutBack', advanceOn: 'beat' },
    { pose: 'rightStep', durationMs: 360, ease: 'easeInOut', advanceOn: 'bassHit' },
  ],
}

export const mechanicalSequence: DanceMap = {
  schemaVersion: 1,
  id: 'mechanical',
  label: 'Mechanical',
  loop: true,
  intensity: 0.9,
  loose: 0.2,
  poses: {
    robot: basicPoses.robot,
    armsUp: { ...basicPoses.robot, rotations: { ...basicPoses.robot.rotations, leftShoulder: -175, rightShoulder: -5, leftElbow: -50, rightElbow: -130 } },
    waveLeft: { ...basicPoses.robot, rotations: { ...basicPoses.robot.rotations, leftShoulder: -160, leftElbow: -40 } },
    waveRight: { ...basicPoses.robot, rotations: { ...basicPoses.robot.rotations, rightShoulder: -20, rightElbow: -40 } },
    bounce: { ...basicPoses.robot, offset: { x: 0, y: 8 }, scale: 1.03 },
  },
  triggerAccents: {
    beat: ['browFlash'],
    bassHit: ['kneeDip'],
  },
  steps: [
    { pose: 'robot', durationMs: 350, ease: 'snap' },
    { pose: 'armsUp', durationMs: 200, ease: 'snap', beatSnap: true },
    { pose: 'waveLeft', durationMs: 250, ease: 'snap', advanceOn: 'beat' },
    { pose: 'robot', durationMs: 300, ease: 'snap' },
    { pose: 'waveRight', durationMs: 250, ease: 'snap', advanceOn: 'bassHit' },
    { pose: 'bounce', durationMs: 180, ease: 'snap', beatSnap: true },
  ],
}
