import type { ResolvedPose } from '../types'
import type { RigDefinition, RigJoint } from './types'
import type { SolvedJoint } from '../types'

function degToRad(deg: number) {
  return (deg * Math.PI) / 180
}

export class PuppetRigSolver {
  constructor(private readonly rig: RigDefinition) {}

  solve(pose: ResolvedPose, rootX: number, rootY: number, scale: number): Map<string, SolvedJoint> {
    const joints = new Map<string, SolvedJoint>()
    for (const joint of this.rig.joints) {
      joints.set(joint.id, this.solveJoint(joint, pose, joints, rootX, rootY, scale))
    }
    return joints
  }

  private solveJoint(
    joint: RigJoint,
    pose: ResolvedPose,
    solved: Map<string, SolvedJoint>,
    rootX: number,
    rootY: number,
    scale: number,
  ): SolvedJoint {
    const angle = pose.angles[joint.id] ?? joint.angle
    const angleRad = degToRad(angle)
    const parent = joint.parent ? solved.get(joint.parent) : undefined
    const originX = parent?.x ?? rootX
    const originY = parent?.y ?? rootY
    const length = joint.length * scale
    return {
      x: originX + Math.cos(angleRad) * length,
      y: originY + Math.sin(angleRad) * length,
      angle,
      radius: joint.radius * scale,
    }
  }
}

export function getVerticalBounds(joints: Map<string, SolvedJoint>) {
  let top = Infinity
  let bottom = -Infinity
  for (const joint of joints.values()) {
    top = Math.min(top, joint.y - joint.radius)
    bottom = Math.max(bottom, joint.y + joint.radius)
  }
  const center = (top + bottom) / 2
  return { top, bottom, center }
}
