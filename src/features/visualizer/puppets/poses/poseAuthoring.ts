import type { FaceState, ResolvedPose } from '../types'
import { defaultFace } from '../types'
import type { RigDefinition } from '../rig/types'
import type { PuppetPoseMap } from './poseTypes'
import { clampJointAngle } from '../rig/jointLimits'

export function poseMapToResolved(map: PuppetPoseMap, rig: RigDefinition): ResolvedPose {
  const angles: Record<string, number> = {}
  for (const joint of rig.joints) {
    angles[joint.id] = map.rotations?.[joint.id] ?? joint.angle
  }
  return {
    angles,
    offset: { x: map.offset?.x ?? 0, y: map.offset?.y ?? 0 },
    scale: map.scale ?? 1,
    face: { ...defaultFace(), ...map.face },
  }
}

export function mergeResolved(base: ResolvedPose, patch: PuppetPoseMap, amount: number): ResolvedPose {
  const next: ResolvedPose = {
    angles: { ...base.angles },
    offset: { ...base.offset },
    scale: base.scale,
    face: { ...base.face },
  }
  if (patch.rotations) {
    for (const [jointId, angle] of Object.entries(patch.rotations)) {
      const from = next.angles[jointId] ?? angle
      next.angles[jointId] = clampJointAngle(jointId, from + (angle - from) * amount)
    }
  }
  if (patch.offset) {
    next.offset.x += (patch.offset.x ?? 0) * amount
    next.offset.y += (patch.offset.y ?? 0) * amount
  }
  if (patch.scale !== undefined) {
    next.scale += (patch.scale - 1) * amount
  }
  if (patch.face) {
    next.face = mergeFace(next.face, patch.face, amount)
  }
  return next
}

function mergeFace(base: FaceState, patch: Partial<FaceState>, amount: number): FaceState {
  const next = { ...base }
  for (const [key, value] of Object.entries(patch) as Array<[keyof FaceState, number]>) {
    next[key] = base[key] + (value - base[key]) * amount
  }
  return next
}

export function lerpResolved(from: ResolvedPose, to: ResolvedPose, t: number, rig: RigDefinition): ResolvedPose {
  const angles: Record<string, number> = {}
  for (const joint of rig.joints) {
    const a = from.angles[joint.id] ?? joint.angle
    const b = to.angles[joint.id] ?? joint.angle
    angles[joint.id] = clampJointAngle(joint.id, a + (b - a) * t)
  }
  return {
    angles,
    offset: {
      x: from.offset.x + (to.offset.x - from.offset.x) * t,
      y: from.offset.y + (to.offset.y - from.offset.y) * t,
    },
    scale: from.scale + (to.scale - from.scale) * t,
    face: mergeFace(from.face, to.face, t),
  }
}
