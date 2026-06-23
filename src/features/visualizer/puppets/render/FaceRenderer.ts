import type { FaceState, SolvedJoint } from '../types'
import type { PuppetSkin } from '../skins'
import type { FaceKit } from '../faces/faceKits'

export class FaceRenderer {
  draw(
    ctx: CanvasRenderingContext2D,
    head: SolvedJoint,
    face: FaceState,
    scale: number,
    skin: PuppetSkin,
    kit: FaceKit,
  ) {
    const headR = head.radius * kit.headScale
    const x = head.x
    const y = head.y

    this.drawHeadBase(ctx, x, y, headR, skin, kit)
    if (kit.cheekAlpha > 0) this.drawCheeks(ctx, x, y, scale, skin, kit.cheekAlpha)
    if (kit.browStyle !== 'none') this.drawBrows(ctx, x, y, scale, face, skin, kit)
    if (kit.style === 'robot') this.drawRobotEyes(ctx, x, y, scale, face, skin, kit)
    else this.drawHumanEyes(ctx, x, y, scale, face, skin, kit)
    if (kit.style === 'robot') this.drawRobotMouth(ctx, x, y, scale, face, skin)
    else this.drawHumanMouth(ctx, x, y, scale, face, skin, kit.mouthStyle)
  }

  private drawHeadBase(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, skin: PuppetSkin, kit: FaceKit) {
    const g = ctx.createRadialGradient(x, y - r * 0.2, r * 0.1, x, y, r)
    g.addColorStop(0, skin.faceHighlight)
    g.addColorStop(1, skin.face)
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
    if (kit.style === 'robot') {
      ctx.strokeStyle = skin.accent
      ctx.lineWidth = Math.max(1, r * 0.08)
      ctx.stroke()
    }
  }

  private drawCheeks(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, skin: PuppetSkin, alpha: number) {
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.fillStyle = skin.cheek.includes('rgba') ? skin.cheek : '#ff788c'
    for (const side of [-1, 1]) {
      ctx.beginPath()
      ctx.ellipse(x + side * 5.5 * scale, y + 2.5 * scale, 2.8 * scale, 1.6 * scale, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }

  private drawBrows(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, f: FaceState, skin: PuppetSkin, kit: FaceKit) {
    const browY = y - 7.5 * scale
    const spacing = 5.2 * scale * kit.eyeSpacing
    ctx.strokeStyle = skin.brow
    ctx.lineWidth = Math.max(1.4, 2.1 * scale)
    ctx.lineCap = 'round'

    for (const side of [-1, 1] as const) {
      const lift = side === -1 ? f.leftBrowLift : f.rightBrowLift
      const rotate = side === -1 ? f.leftBrowRotate : f.rightBrowRotate
      const bx = x + side * spacing
      const by = browY - lift * 3.5 * scale
      const len = (kit.browStyle === 'sharp' ? 5 : 4.2) * scale
      const angle = (kit.browStyle === 'flat' ? 0 : -0.25 + rotate * 0.55) * side
      ctx.save()
      ctx.translate(bx, by)
      ctx.rotate(angle)
      ctx.beginPath()
      if (kit.browStyle === 'sharp') {
        ctx.moveTo(-len * 0.5, 0)
        ctx.lineTo(len * 0.5, -0.8 * scale)
      } else {
        ctx.moveTo(-len * 0.5, 0)
        ctx.quadraticCurveTo(0, -1.2 * scale, len * 0.5, 0)
      }
      ctx.stroke()
      ctx.restore()
    }
  }

  private drawHumanEyes(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, f: FaceState, skin: PuppetSkin, kit: FaceKit) {
    const eyeY = y - 3.2 * scale
    const spacing = 5 * scale * kit.eyeSpacing
    const whiteW = 3.1 * scale * kit.eyeScale
    const whiteH = 2.6 * scale * kit.eyeScale
    const lidClose = 1 - Math.max(0, Math.min(1, f.eyeOpen))

    for (const side of [-1, 1]) {
      const ex = x + side * spacing
      const pupilX = ex + f.pupilX * 1.8 * scale
      const pupilY = eyeY + f.pupilY * 1.6 * scale

      ctx.fillStyle = skin.eyeWhite
      ctx.beginPath()
      ctx.ellipse(ex, eyeY, whiteW, whiteH, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = skin.lidLine
      ctx.lineWidth = Math.max(1, 1.2 * scale)
      ctx.stroke()

      if (lidClose < 0.92) {
        const pupilR = Math.max(0.8, 1.35 * scale * kit.eyeScale)
        ctx.fillStyle = skin.pupil
        ctx.beginPath()
        ctx.arc(pupilX, pupilY, pupilR, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = skin.pupilHighlight
        ctx.beginPath()
        ctx.arc(pupilX - pupilR * 0.35, pupilY - pupilR * 0.35, pupilR * 0.28, 0, Math.PI * 2)
        ctx.fill()
      }

      if (lidClose > 0.02) {
        ctx.fillStyle = skin.lid
        const lidH = whiteH * lidClose
        ctx.beginPath()
        ctx.ellipse(ex, eyeY - whiteH + lidH * 0.5, whiteW + 0.4 * scale, lidH, 0, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }

  private drawRobotEyes(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, f: FaceState, skin: PuppetSkin, kit: FaceKit) {
    const eyeY = y - 2.8 * scale
    const spacing = 5.5 * scale * kit.eyeSpacing
    const w = 4.2 * scale
    const h = 2.2 * scale
    const open = f.eyeOpen

    for (const side of [-1, 1]) {
      const ex = x + side * spacing
      ctx.fillStyle = skin.eyeWhite
      ctx.fillRect(ex - w / 2, eyeY - h / 2, w, h * open)
      ctx.strokeStyle = skin.accent
      ctx.lineWidth = Math.max(1, 1.4 * scale)
      ctx.strokeRect(ex - w / 2, eyeY - h / 2, w, h * Math.max(0.15, open))
      if (open > 0.2) {
        ctx.fillStyle = skin.pupil
        const px = ex + f.pupilX * scale
        ctx.fillRect(px - 1.2 * scale, eyeY - 0.8 * scale, 2.4 * scale, 1.6 * scale)
      }
    }
  }

  private drawHumanMouth(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    scale: number,
    f: FaceState,
    skin: PuppetSkin,
    style: FaceKit['mouthStyle'],
  ) {
    const mouthY = y + 5.8 * scale + f.bottomLipY * scale
    const smile = style === 'smirk' ? f.mouthSmile * 0.7 + 0.12 : f.mouthSmile
    const open = Math.max(0, f.mouthOpen)
    const widthMul = style === 'wide' ? 1.25 : style === 'small' ? 0.82 : 1
    const width = (6.2 + smile * 2.8) * scale * widthMul
    const topY = mouthY + f.topLipY * scale - open * 1.2 * scale

    if (open > 0.08) {
      ctx.fillStyle = skin.mouthInterior
      ctx.beginPath()
      ctx.ellipse(x, mouthY + open * 1.5 * scale, width * 0.72, Math.max(1.2, open * 3.2 * scale), 0, 0, Math.PI)
      ctx.fill()
    }
    if (f.tongue > 0.05 && open > 0.12) {
      ctx.fillStyle = skin.tongue
      ctx.beginPath()
      ctx.ellipse(x, mouthY + open * 2 * scale, width * 0.38, open * 2.4 * scale * f.tongue, 0, 0, Math.PI)
      ctx.fill()
    }
    ctx.strokeStyle = skin.lip
    ctx.lineWidth = Math.max(1.5, 2.2 * scale)
    ctx.lineCap = 'round'
    ctx.beginPath()
    const upperCurve = 1.5 + smile * 2.2
    ctx.moveTo(x - width * 0.5, topY)
    ctx.quadraticCurveTo(x, topY - upperCurve * scale * 0.15, x + width * 0.5, topY)
    ctx.stroke()
    ctx.beginPath()
    const lowerY = mouthY + open * 2.4 * scale
    ctx.moveTo(x - width * 0.48, lowerY - smile * 0.85 * scale)
    ctx.quadraticCurveTo(x, lowerY + (1.8 + smile * 2) * scale, x + width * 0.48, lowerY - smile * 0.85 * scale)
    ctx.stroke()
  }

  private drawRobotMouth(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, f: FaceState, skin: PuppetSkin) {
    const mouthY = y + 6 * scale
    const open = f.mouthOpen
    ctx.strokeStyle = skin.accent
    ctx.lineWidth = Math.max(1.2, 1.6 * scale)
    const slots = 4
    for (let i = 0; i < slots; i++) {
      const sx = x - 4 * scale + i * 2.2 * scale
      const sh = 1.2 * scale + open * 2 * scale
      ctx.strokeRect(sx, mouthY - sh / 2, 1.6 * scale, sh)
    }
  }
}
