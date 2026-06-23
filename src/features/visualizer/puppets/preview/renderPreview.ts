import { getCharacter } from '../characters'
import { getFaceKit } from '../faces/faceKits'
import { getPuppet } from '../registry'
import { PuppetRigSolver } from '../rig/PuppetRigSolver'
import { poseMapToResolved } from '../poses/poseAuthoring'
import { basicPoses } from '../poses/basicPoses'
import { PuppetRenderer } from '../render/PuppetRenderer'
import { resolveVerticalLayout } from '../render/layout'
import { getSkin } from '../skins'

export function renderPuppetPreview(canvas: HTMLCanvasElement, characterId: string) {
  const char = getCharacter(characterId)
  const puppet = getPuppet('human-default')
  const solver = new PuppetRigSolver(puppet.rig)
  const pose = poseMapToResolved(basicPoses.idle, puppet.rig)
  const kit = getFaceKit(char.faceKitId)
  Object.assign(pose.face, kit.defaultExpression)

  const w = canvas.width
  const h = canvas.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, w, h)
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, '#0b1021')
  g.addColorStop(1, '#1a1030')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)

  const scale = Math.min(w, h) / 332
  const rootX = w * 0.5
  const { rootY } = resolveVerticalLayout(solver, pose, rootX, h, scale)
  const joints = solver.solve(pose, rootX, rootY, scale)

  const renderer = new PuppetRenderer(ctx, getSkin(char.skinId))
  renderer.setOutfit(char.outfitId)
  renderer.setFaceKit(char.faceKitId)
  renderer.drawPuppet(joints, pose, scale)
}
