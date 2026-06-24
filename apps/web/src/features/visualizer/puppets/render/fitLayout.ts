import type { FitMode } from '../../project/types'
import type { SolvedJoint } from '../types'

const BASE = 332

export type PuppetFitLayout = {
  stageScale: number
  stretchX: number
  stretchY: number
}

export function computePuppetFitLayout(
  width: number,
  height: number,
  fit: FitMode,
  poseScale: number,
): PuppetFitLayout {
  const w = Math.max(1, width)
  const h = Math.max(1, height)

  switch (fit) {
    case 'cover':
      return { stageScale: (Math.max(w, h) / BASE) * poseScale, stretchX: 1, stretchY: 1 }
    case 'stretch': {
      const sx = w / BASE
      const sy = h / BASE
      return { stageScale: poseScale, stretchX: sx, stretchY: sy }
    }
    case 'original':
    case 'custom':
    case 'contain':
    default:
      return { stageScale: (Math.min(w, h) / BASE) * poseScale, stretchX: 1, stretchY: 1 }
  }
}

export function applyStretchToJoints(
  joints: Map<string, SolvedJoint>,
  rootX: number,
  rootY: number,
  stretchX: number,
  stretchY: number,
) {
  if (stretchX === 1 && stretchY === 1) return joints
  for (const [id, joint] of joints) {
    joints.set(id, {
      ...joint,
      x: rootX + (joint.x - rootX) * stretchX,
      y: rootY + (joint.y - rootY) * stretchY,
      radius: joint.radius * Math.min(stretchX, stretchY),
    })
  }
  return joints
}
