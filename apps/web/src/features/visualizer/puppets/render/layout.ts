export const ROOT_TO_STAGE_Y = 126

import { getVerticalBounds, PuppetRigSolver } from '../rig/PuppetRigSolver'
import type { ResolvedPose } from '../types'

export function resolveVerticalLayout(
  solver: PuppetRigSolver,
  pose: ResolvedPose,
  rootX: number,
  height: number,
  scale: number,
) {
  const neutralJoints = solver.solve(pose, rootX, 0, scale)
  const bounds = getVerticalBounds(neutralJoints)
  const rootY = height * 0.5 - bounds.center + pose.offset.y
  const neutralRoot = solver.solve(pose, rootX, rootY, scale).get('root')
  const neutralRootY = neutralRoot?.y ?? rootY
  const stageY = Math.max(34, Math.min(height - 34, neutralRootY + ROOT_TO_STAGE_Y * scale))
  return { rootY, stageY }
}
