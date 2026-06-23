import type { ResolvedPose, SolvedJoint } from '../types'
import type { PuppetSkin } from '../skins'
import type { OutfitDefinition } from '../outfits/types'
import type { FaceKit } from '../faces/faceKits'
import { getFaceKit } from '../faces/faceKits'
import { getOutfit } from '../outfits'
import { drawOutfit } from '../outfits/definitions'
import { BodyRenderer } from './BodyRenderer'
import { FaceRenderer } from './FaceRenderer'

export class PuppetRenderer {
  private readonly bodyRenderer = new BodyRenderer()
  private readonly faceRenderer = new FaceRenderer()
  private outfit: OutfitDefinition = getOutfit('none')
  private faceKit: FaceKit = getFaceKit('neon-raver')

  constructor(
    private readonly ctx: CanvasRenderingContext2D,
    private skin: PuppetSkin,
  ) {}

  setSkin(skin: PuppetSkin) {
    this.skin = skin
  }

  setOutfit(outfitId: string) {
    this.outfit = getOutfit(outfitId)
  }

  setFaceKit(faceKitId: string) {
    this.faceKit = getFaceKit(faceKitId)
  }

  clear(w: number, h: number) {
    this.ctx.clearRect(0, 0, w, h)
  }

  drawStage(w: number, h: number, energy: number, lowPower: boolean, stageY: number) {
    const g = this.ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, 'rgba(8,12,28,0.15)')
    g.addColorStop(1, 'rgba(8,12,28,0.55)')
    this.ctx.fillStyle = g
    this.ctx.fillRect(0, 0, w, h)

    this.ctx.save()
    this.ctx.globalAlpha = 0.35 + energy * 0.35
    this.ctx.fillStyle = this.skin.accent
    this.ctx.beginPath()
    this.ctx.ellipse(w * 0.5, stageY, w * 0.28, h * 0.04, 0, 0, Math.PI * 2)
    this.ctx.fill()
    this.ctx.restore()

    if (lowPower) return
    this.ctx.strokeStyle = `rgba(34,211,238,${0.08 + energy * 0.12})`
    this.ctx.lineWidth = 1
    for (let i = 0; i < 3; i++) {
      const x = w * (0.25 + i * 0.25)
      this.ctx.beginPath()
      this.ctx.moveTo(x, 0)
      this.ctx.lineTo(w * 0.5, stageY - h * 0.08)
      this.ctx.stroke()
    }
  }

  drawPuppet(joints: Map<string, SolvedJoint>, pose: ResolvedPose, scale: number) {
    const bodyScale = scale * this.outfit.bodyScale
    this.bodyRenderer.drawShadow(this.ctx, joints, bodyScale, this.skin.shadow)

    if (this.outfit.id !== 'none') {
      drawOutfit(this.ctx, joints, bodyScale, this.outfit)
    }

    this.bodyRenderer.drawLimbs(this.ctx, joints, scale, this.skin, this.outfit)

    const head = joints.get('head')
    if (head) this.faceRenderer.draw(this.ctx, head, pose.face, scale, this.skin, this.faceKit)
  }
}
