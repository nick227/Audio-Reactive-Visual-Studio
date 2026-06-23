import type { PuppetPoseMap } from './poseTypes'

export const namedAccents: Record<string, PuppetPoseMap> = {
  hipBounce: {
    id: 'hipBounce',
    label: 'Hip Bounce',
    rotations: { hips: 10, spine: -84 },
    offset: { x: 0, y: 14 },
    scale: 1.06,
    face: { mouthOpen: 0.35 },
  },
  headNod: {
    id: 'headNod',
    label: 'Head Nod',
    rotations: { neck: -78, head: -78 },
    face: { mouthOpen: 0.2, pupilY: 0.15 },
  },
  kneeDip: {
    id: 'kneeDip',
    label: 'Knee Dip',
    rotations: { leftKnee: 128, rightKnee: 128, hips: 6 },
    offset: { x: 0, y: 16 },
    scale: 0.96,
  },
  armWave: {
    id: 'armWave',
    label: 'Arm Wave',
    rotations: { rightShoulder: -20, rightElbow: -40, rightWrist: -50 },
    face: { mouthSmile: 0.35, mouthOpen: 0.22 },
  },
}
