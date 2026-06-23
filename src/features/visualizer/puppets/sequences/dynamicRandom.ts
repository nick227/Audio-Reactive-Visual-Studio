import type { DanceMap, EaseKind } from '../poses/poseTypes'
import { basicPoses } from '../poses/basicPoses'

const EASES: EaseKind[] = ['easeInOut', 'easeOutBack', 'elasticOut', 'snap', 'linear']
const POSE_KEYS = ['idle', 'bounce', 'leftStep', 'rightStep', 'robot'] as const

function mulberry32(seed: number) {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

export function buildDynamicRandomDance(seed: number): DanceMap {
  const rand = mulberry32(seed)
  const stepCount = 3 + Math.floor(rand() * 4)
  const poses: DanceMap['poses'] = {
    idle: basicPoses.idle,
    bounce: basicPoses.bounce,
    leftStep: basicPoses.leftStep,
    rightStep: basicPoses.rightStep,
    robot: basicPoses.robot,
  }

  const steps: DanceMap['steps'] = []
  for (let i = 0; i < stepCount; i++) {
    const pose = POSE_KEYS[Math.floor(rand() * POSE_KEYS.length)]
    const durationMs = 160 + Math.floor(rand() * 280)
    const ease = EASES[Math.floor(rand() * EASES.length)]
    const beatSnap = rand() > 0.55
    const accents = rand() > 0.7 ? [['hipBounce', 'headNod', 'kneeDip', 'armWave'][Math.floor(rand() * 4)]] : undefined
    steps.push({
      pose,
      durationMs,
      ease,
      beatSnap,
      accents,
      advanceOn: rand() > 0.62 ? (['beat', 'bassHit', 'highsHit'] as const)[Math.floor(rand() * 3)] : undefined,
    })
  }

  return {
    schemaVersion: 1,
    id: `dynamicRandom-${seed}`,
    label: 'Random Mix',
    loop: true,
    intensity: 0.75 + rand() * 0.35,
    loose: 0.55 + rand() * 0.28,
    poses,
    triggerAccents: {
      beat: ['hipBounce'],
      bassHit: ['kneeDip'],
      highsHit: ['armWave'],
      chaosHit: ['armWave', 'headNod'],
    },
    steps,
  }
}
