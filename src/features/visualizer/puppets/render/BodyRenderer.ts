import type { SolvedJoint } from '../types'
import type { PuppetSkin } from '../skins'
import type { OutfitDefinition } from '../outfits/types'

const TORSO: Array<[string, string]> = [
  ['hips', 'spine'],
  ['spine', 'chest'],
  ['chest', 'neck'],
  ['neck', 'head'],
]
const ARMS: Array<[string, string]> = [
  ['leftShoulder', 'leftElbow'],
  ['leftElbow', 'leftWrist'],
  ['rightShoulder', 'rightElbow'],
  ['rightElbow', 'rightWrist'],
]
const LEGS: Array<[string, string]> = [
  ['hips', 'leftHip'],
  ['leftHip', 'leftKnee'],
  ['leftKnee', 'leftAnkle'],
  ['hips', 'rightHip'],
  ['rightHip', 'rightKnee'],
  ['rightKnee', 'rightAnkle'],
]

export class BodyRenderer {
  drawShadow(ctx: CanvasRenderingContext2D, joints: Map<string, SolvedJoint>, scale: number, shadow: string) {
    const hips = joints.get('hips')
    if (!hips) return
    const width = Math.max(3, 7 * scale * 1.35)
    ctx.strokeStyle = shadow
    ctx.lineWidth = width
    ctx.lineCap = 'round'
    for (const ankleId of ['leftAnkle', 'rightAnkle']) {
      const ankle = joints.get(ankleId)
      if (!ankle) continue
      ctx.beginPath()
      ctx.moveTo(hips.x, hips.y)
      ctx.lineTo(ankle.x, ankle.y)
      ctx.stroke()
    }
  }

  drawLimbs(
    ctx: CanvasRenderingContext2D,
    joints: Map<string, SolvedJoint>,
    scale: number,
    skin: PuppetSkin,
    outfit: OutfitDefinition,
  ) {
    const bodyScale = scale * outfit.bodyScale
    const torsoW = Math.max(2.8, 6.2 * bodyScale)
    const limbW = Math.max(2.4, 5.2 * bodyScale * outfit.limbScale)
    const armW = Math.max(2.2, 4.6 * bodyScale * outfit.limbScale)

    this.drawSegmentGroup(ctx, joints, TORSO, torsoW, skin.line, skin.shadow)
    this.drawSegmentGroup(ctx, joints, LEGS, limbW, skin.line, skin.shadow)
    this.drawSegmentGroup(ctx, joints, ARMS, armW, skin.line, skin.shadow)

    if (outfit.id === 'none') {
      this.drawJoints(ctx, joints, ['hips', 'spine', 'chest', 'neck', 'leftHip', 'leftKnee', 'leftAnkle', 'rightHip', 'rightKnee', 'rightAnkle'], skin.joint)
      this.drawJoints(ctx, joints, ['leftShoulder', 'leftElbow', 'leftWrist', 'rightShoulder', 'rightElbow', 'rightWrist'], skin.joint)
    } else {
      this.drawJoints(ctx, joints, ['leftShoulder', 'leftElbow', 'rightShoulder', 'rightElbow'], skin.joint)
      this.drawHands(ctx, joints, scale, skin)
    }
  }

  private drawSegmentGroup(
    ctx: CanvasRenderingContext2D,
    joints: Map<string, SolvedJoint>,
    pairs: Array<[string, string]>,
    width: number,
    color: string,
    shadow: string,
  ) {
    ctx.lineCap = 'round'
    for (const [a, b] of pairs) {
      const from = joints.get(a)
      const to = joints.get(b)
      if (!from || !to) continue
      ctx.strokeStyle = shadow
      ctx.lineWidth = width * 1.28
      ctx.beginPath()
      ctx.moveTo(from.x, from.y)
      ctx.lineTo(to.x, to.y)
      ctx.stroke()
      ctx.strokeStyle = color
      ctx.lineWidth = width
      ctx.beginPath()
      ctx.moveTo(from.x, from.y)
      ctx.lineTo(to.x, to.y)
      ctx.stroke()
    }
  }

  private drawJoints(ctx: CanvasRenderingContext2D, joints: Map<string, SolvedJoint>, ids: string[], color: string) {
    for (const id of ids) {
      const joint = joints.get(id)
      if (!joint) continue
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(joint.x, joint.y, joint.radius, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  private drawHands(ctx: CanvasRenderingContext2D, joints: Map<string, SolvedJoint>, scale: number, skin: PuppetSkin) {
    for (const id of ['leftWrist', 'rightWrist']) {
      const wrist = joints.get(id)
      if (!wrist) continue
      ctx.fillStyle = skin.face
      ctx.beginPath()
      ctx.arc(wrist.x, wrist.y, Math.max(2.2, 2.8 * scale), 0, Math.PI * 2)
      ctx.fill()
    }
  }
}
