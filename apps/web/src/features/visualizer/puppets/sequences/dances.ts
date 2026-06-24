import type { DanceMap } from '../poses/poseTypes'
import { basicPoses } from '../poses/basicPoses'

export const idleSequence: DanceMap = {
  schemaVersion: 1,
  id: 'idle',
  label: 'Idle Sway',
  loop: true,
  intensity: 0.6,
  loose: 0.82,
  poses: { idle: basicPoses.idle },
  steps: [{ pose: 'idle', durationMs: 1200, ease: 'easeInOut' }],
}

export const bounceSequence: DanceMap = {
  schemaVersion: 1,
  id: 'bounce',
  label: 'Bounce',
  loop: true,
  intensity: 1,
  loose: 0.74,
  reducedMotion: { sequence: 'idle', intensity: 0.3 },
  poses: {
    idle: basicPoses.idle,
    bounce: basicPoses.bounce,
    leftStep: basicPoses.leftStep,
    rightStep: basicPoses.rightStep,
    armsUp: basicPoses.armsUp,
    jazzHands: basicPoses.jazzHands,
    kickLeft: basicPoses.kickLeft,
  },
  triggerAccents: {
    beat: ['hipBounce', 'headNod', 'browFlash'],
    bassHit: ['hipBounce', 'kneeDip', 'jawDrop'],
    highsHit: ['armWave', 'wideEyes'],
    chaosHit: ['oFace'],
  },
  steps: [
    { pose: 'bounce', durationMs: 220, holdMs: 40, ease: 'easeInOut', accents: ['kneeDip'], beatSnap: true },
    { pose: 'armsUp', durationMs: 240, ease: 'easeOutBack', accents: ['bigGrin'] },
    { pose: 'leftStep', durationMs: 260, ease: 'easeInOut', advanceOn: 'bassHit' },
    { pose: 'kickLeft', durationMs: 280, ease: 'easeInOut', beatSnap: true },
    { pose: 'bounce', durationMs: 200, ease: 'easeOutBack' },
    { pose: 'jazzHands', durationMs: 260, ease: 'elasticOut', advanceOn: 'highsHit' },
    { pose: 'rightStep', durationMs: 260, ease: 'easeInOut', advanceOn: 'bassHit' },
  ],
}

export const goofyTwoStepSequence: DanceMap = {
  schemaVersion: 1,
  id: 'goofyTwoStep',
  label: 'Goofy Two Step',
  loop: true,
  intensity: 0.9,
  loose: 0.7,
  reducedMotion: { sequence: 'idle', intensity: 0.35 },
  poses: {
    idle: basicPoses.idle,
    leftStep: basicPoses.leftStep,
    rightStep: basicPoses.rightStep,
    bounce: basicPoses.bounce,
    waveLeft: basicPoses.waveLeft,
    waveRight: basicPoses.waveRight,
    kickLeft: basicPoses.kickLeft,
  },
  triggerAccents: {
    beat: ['hipBounce', 'bigGrin'],
    bassHit: ['kneeDip', 'bassWink'],
    chaosHit: ['armWave', 'oFace'],
  },
  steps: [
    { pose: 'leftStep', durationMs: 320, ease: 'easeInOut', beatSnap: true },
    { pose: 'waveLeft', durationMs: 260, ease: 'easeOutBack', accents: ['smirk'] },
    { pose: 'bounce', durationMs: 180, ease: 'snap', accents: ['headNod'] },
    { pose: 'rightStep', durationMs: 320, ease: 'easeInOut', advanceOn: 'beat' },
    { pose: 'waveRight', durationMs: 260, ease: 'easeOutBack' },
    { pose: 'kickLeft', durationMs: 300, ease: 'easeInOut', advanceOn: 'bassHit', accents: ['kneeDip'] },
    { pose: 'bounce', durationMs: 180, ease: 'elasticOut' },
  ],
}

export const robotSequence: DanceMap = {
  schemaVersion: 1,
  id: 'robot',
  label: 'Robot',
  loop: true,
  intensity: 0.85,
  loose: 0.35,
  poses: {
    idle: basicPoses.robot,
    robot: basicPoses.robot,
    bounce: { ...basicPoses.robot, offset: { x: 0, y: 6 }, scale: 1.02 },
    waveLeft: { ...basicPoses.robot, rotations: { ...basicPoses.robot.rotations, leftShoulder: -160, leftElbow: -40 } },
    waveRight: { ...basicPoses.robot, rotations: { ...basicPoses.robot.rotations, rightShoulder: -20, rightElbow: -40 } },
    armsUp: { ...basicPoses.robot, rotations: { ...basicPoses.robot.rotations, leftShoulder: -175, rightShoulder: -5, leftElbow: -50, rightElbow: -130 } },
  },
  triggerAccents: {
    beat: ['headNod', 'browFlash'],
    bassHit: ['kneeDip', 'jawDrop'],
  },
  steps: [
    { pose: 'robot', durationMs: 350, ease: 'snap' },
    { pose: 'waveLeft', durationMs: 220, ease: 'snap', beatSnap: true },
    { pose: 'armsUp', durationMs: 200, ease: 'snap' },
    { pose: 'bounce', durationMs: 180, ease: 'snap', advanceOn: 'bassHit' },
    { pose: 'waveRight', durationMs: 220, ease: 'snap', beatSnap: true },
    { pose: 'robot', durationMs: 350, ease: 'snap' },
  ],
}
