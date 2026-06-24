const ARM_JOINTS = new Set(['leftShoulder', 'leftElbow', 'leftWrist', 'rightShoulder', 'rightElbow', 'rightWrist'])
const LEG_JOINTS = new Set(['leftHip', 'leftKnee', 'leftAnkle', 'rightHip', 'rightKnee', 'rightAnkle'])

const LIMITS: Record<string, [number, number]> = {
  leftShoulder: [-200, -60],
  rightShoulder: [-120, 20],
  leftElbow: [-180, -40],
  rightElbow: [-140, -20],
  leftWrist: [-150, -30],
  rightWrist: [-150, -30],
  leftHip: [70, 170],
  rightHip: [10, 110],
  leftKnee: [60, 150],
  rightKnee: [30, 120],
  leftAnkle: [60, 120],
  rightAnkle: [60, 120],
  hips: [-30, 30],
  spine: [-110, -70],
  chest: [-110, -70],
  neck: [-110, -70],
  head: [-110, -70],
}

export function clampJointAngle(jointId: string, angle: number): number {
  const range = LIMITS[jointId]
  if (!range) return angle
  return Math.max(range[0], Math.min(range[1], angle))
}

export function lerpJointAngle(jointId: string, from: number, to: number, t: number): number {
  if (ARM_JOINTS.has(jointId) || LEG_JOINTS.has(jointId)) {
    return clampJointAngle(jointId, from + (to - from) * t)
  }
  return from + (to - from) * t
}
