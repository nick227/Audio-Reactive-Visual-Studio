import type { SolvedJoint } from '../types'

export function joint(joints: Map<string, SolvedJoint>, id: string) {
  return joints.get(id)
}

export function drawCapsule(
  ctx: CanvasRenderingContext2D,
  from: SolvedJoint,
  to: SolvedJoint,
  radius: number,
  fill: string,
  stroke?: string,
) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.hypot(dx, dy) || 1
  const nx = (-dy / len) * radius
  const ny = (dx / len) * radius

  ctx.fillStyle = fill
  ctx.beginPath()
  ctx.moveTo(from.x + nx, from.y + ny)
  ctx.lineTo(to.x + nx, to.y + ny)
  ctx.arc(to.x, to.y, radius, Math.atan2(dy, dx) - Math.PI / 2, Math.atan2(dy, dx) + Math.PI / 2)
  ctx.lineTo(from.x - nx, from.y - ny)
  ctx.arc(from.x, from.y, radius, Math.atan2(dy, dx) + Math.PI / 2, Math.atan2(dy, dx) - Math.PI / 2)
  ctx.closePath()
  ctx.fill()

  if (stroke) {
    ctx.strokeStyle = stroke
    ctx.lineWidth = Math.max(1, radius * 0.22)
    ctx.stroke()
  }
}

export function drawTorsoPanel(
  ctx: CanvasRenderingContext2D,
  chest: SolvedJoint,
  hips: SolvedJoint,
  neck: SolvedJoint,
  halfWidth: number,
  fill: string,
  stroke?: string,
) {
  const topW = halfWidth * 0.92
  const botW = halfWidth * 1.08
  ctx.fillStyle = fill
  ctx.beginPath()
  ctx.moveTo(neck.x - topW * 0.55, neck.y + 2)
  ctx.lineTo(neck.x + topW * 0.55, neck.y + 2)
  ctx.lineTo(chest.x + topW, chest.y)
  ctx.lineTo(hips.x + botW, hips.y)
  ctx.lineTo(hips.x - botW, hips.y)
  ctx.lineTo(chest.x - topW, chest.y)
  ctx.closePath()
  ctx.fill()
  if (stroke) {
    ctx.strokeStyle = stroke
    ctx.lineWidth = Math.max(1, halfWidth * 0.12)
    ctx.stroke()
  }
}

export function drawShoe(
  ctx: CanvasRenderingContext2D,
  ankle: SolvedJoint,
  knee: SolvedJoint,
  scale: number,
  fill: string,
  style: 'sneaker' | 'heel' | 'boot' | 'loafer',
) {
  const dx = ankle.x - knee.x
  const dy = ankle.y - knee.y
  const angle = Math.atan2(dy, dx)
  ctx.save()
  ctx.translate(ankle.x, ankle.y)
  ctx.rotate(angle + Math.PI / 2)

  ctx.fillStyle = fill
  if (style === 'sneaker') {
    const w = 7.6 * scale
    const h = 3.2 * scale
    const r = 1.2 * scale
    ctx.beginPath()
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(-w / 2, -h / 2, w, h, r)
    } else {
      ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2)
    }
    ctx.fill()
  } else if (style === 'heel') {
    ctx.beginPath()
    ctx.moveTo(-2.4 * scale, 0)
    ctx.lineTo(2.4 * scale, 0)
    ctx.lineTo(1.8 * scale, 4.5 * scale)
    ctx.lineTo(-1.8 * scale, 4.5 * scale)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = fill
    ctx.fillRect(-0.5 * scale, 4.2 * scale, 1 * scale, 2.8 * scale)
  } else if (style === 'boot') {
    const w = 6.4 * scale
    const h = 5.5 * scale
    ctx.beginPath()
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(-w / 2, -2 * scale, w, h, 1 * scale)
    } else {
      ctx.rect(-w / 2, -2 * scale, w, h)
    }
    ctx.fill()
  } else {
    ctx.beginPath()
    ctx.ellipse(0, 1.2 * scale, 3.4 * scale, 1.8 * scale, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

export function drawBelt(
  ctx: CanvasRenderingContext2D,
  hips: SolvedJoint,
  scale: number,
  color: string,
) {
  ctx.fillStyle = color
  ctx.fillRect(hips.x - 8 * scale, hips.y - 1.4 * scale, 16 * scale, 2.8 * scale)
}

export function drawLapel(
  ctx: CanvasRenderingContext2D,
  chest: SolvedJoint,
  neck: SolvedJoint,
  scale: number,
  side: -1 | 1,
  color: string,
) {
  ctx.strokeStyle = color
  ctx.lineWidth = Math.max(1.2, 1.8 * scale)
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(neck.x + side * 2 * scale, neck.y + 2 * scale)
  ctx.lineTo(chest.x + side * 7 * scale, chest.y + 4 * scale)
  ctx.stroke()
}
