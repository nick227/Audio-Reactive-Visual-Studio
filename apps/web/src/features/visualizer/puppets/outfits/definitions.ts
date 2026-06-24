import type { SolvedJoint } from '../types'
import type { OutfitDefinition } from './types'
import { drawBelt, drawCapsule, drawLapel, drawShoe, drawTorsoPanel, joint } from './drawUtils'

type DrawCtx = {
  ctx: CanvasRenderingContext2D
  joints: Map<string, SolvedJoint>
  scale: number
  outfit: OutfitDefinition
}

function s(ctx: DrawCtx) {
  return ctx.scale * ctx.outfit.bodyScale
}

function drawStreetHoodie(d: DrawCtx) {
  const { ctx, joints, outfit } = d
  const sc = s(d)
  const p = outfit.palette
  const hips = joint(joints, 'hips')
  const chest = joint(joints, 'chest')
  const neck = joint(joints, 'neck')
  const head = joint(joints, 'head')
  if (!hips || !chest || !neck) return

  if (head) {
    ctx.fillStyle = p.secondary
    ctx.beginPath()
    ctx.arc(head.x, head.y - head.radius * 0.35, head.radius * 1.15, Math.PI * 1.05, Math.PI * 1.95)
    ctx.fill()
  }

  drawTorsoPanel(ctx, chest, hips, neck, 11 * sc, p.primary, p.trim)
  for (const side of ['left', 'right'] as const) {
    const hip = joint(joints, `${side}Hip`)
    const knee = joint(joints, `${side}Knee`)
    const ankle = joint(joints, `${side}Ankle`)
    const shoulder = joint(joints, `${side}Shoulder`)
    const elbow = joint(joints, `${side}Elbow`)
    const wrist = joint(joints, `${side}Wrist`)
    if (hip && knee) drawCapsule(ctx, hip, knee, 5.2 * sc, p.secondary, p.trim)
    if (knee && ankle) drawCapsule(ctx, knee, ankle, 4.4 * sc, p.secondary, p.trim)
    if (shoulder && elbow) drawCapsule(ctx, shoulder, elbow, 3.8 * sc, p.primary, p.trim)
    if (elbow && wrist) drawCapsule(ctx, elbow, wrist, 3.2 * sc, p.primary, p.trim)
    if (ankle && knee) drawShoe(ctx, ankle, knee, sc, p.shoe, 'sneaker')
  }
}

function drawClubTee(d: DrawCtx) {
  const { ctx, joints, outfit } = d
  const sc = s(d)
  const p = outfit.palette
  const hips = joint(joints, 'hips')
  const chest = joint(joints, 'chest')
  const neck = joint(joints, 'neck')
  if (!hips || !chest || !neck) return

  drawTorsoPanel(ctx, chest, hips, neck, 8.5 * sc, p.primary, p.trim)
  ctx.fillStyle = p.accent
  ctx.fillRect(chest.x - 1.2 * sc, neck.y + 3 * sc, 2.4 * sc, 4 * sc)

  for (const side of ['left', 'right'] as const) {
    const hip = joint(joints, `${side}Hip`)
    const knee = joint(joints, `${side}Knee`)
    const ankle = joint(joints, `${side}Ankle`)
    const shoulder = joint(joints, `${side}Shoulder`)
    const elbow = joint(joints, `${side}Elbow`)
    const wrist = joint(joints, `${side}Wrist`)
    if (hip && knee) drawCapsule(ctx, hip, knee, 4.6 * sc, p.secondary, p.trim)
    if (knee && ankle) drawCapsule(ctx, knee, ankle, 3.6 * sc, p.secondary, p.trim)
    if (shoulder && elbow) drawCapsule(ctx, shoulder, elbow, 3.4 * sc, p.primary, p.trim)
    if (elbow && wrist) drawCapsule(ctx, elbow, wrist, 2.8 * sc, p.primary, p.trim)
    if (ankle && knee) drawShoe(ctx, ankle, knee, sc, p.shoe, 'sneaker')
  }
}

function drawSlimBlazer(d: DrawCtx) {
  const { ctx, joints, outfit } = d
  const sc = s(d)
  const p = outfit.palette
  const hips = joint(joints, 'hips')
  const chest = joint(joints, 'chest')
  const neck = joint(joints, 'neck')
  if (!hips || !chest || !neck) return

  drawTorsoPanel(ctx, chest, hips, neck, 9 * sc, p.primary, p.trim)
  drawLapel(ctx, chest, neck, sc, -1, p.trim)
  drawLapel(ctx, chest, neck, sc, 1, p.trim)
  drawBelt(ctx, hips, sc, p.accent)

  for (const side of ['left', 'right'] as const) {
    const hip = joint(joints, `${side}Hip`)
    const knee = joint(joints, `${side}Knee`)
    const ankle = joint(joints, `${side}Ankle`)
    const shoulder = joint(joints, `${side}Shoulder`)
    const elbow = joint(joints, `${side}Elbow`)
    const wrist = joint(joints, `${side}Wrist`)
    if (hip && knee) drawCapsule(ctx, hip, knee, 3.8 * sc, p.secondary, p.trim)
    if (knee && ankle) drawCapsule(ctx, knee, ankle, 3.2 * sc, p.secondary, p.trim)
    if (shoulder && elbow) drawCapsule(ctx, shoulder, elbow, 3 * sc, p.primary, p.trim)
    if (elbow && wrist) drawCapsule(ctx, elbow, wrist, 2.6 * sc, p.primary, p.trim)
    if (ankle && knee) drawShoe(ctx, ankle, knee, sc, p.shoe, 'loafer')
  }
}

function drawEveningDress(d: DrawCtx) {
  const { ctx, joints, outfit } = d
  const sc = s(d)
  const p = outfit.palette
  const hips = joint(joints, 'hips')
  const chest = joint(joints, 'chest')
  const neck = joint(joints, 'neck')
  const leftKnee = joint(joints, 'leftKnee')
  const rightKnee = joint(joints, 'rightKnee')
  if (!hips || !chest || !neck) return

  const waistY = chest.y + (hips.y - chest.y) * 0.45
  ctx.fillStyle = p.primary
  ctx.beginPath()
  ctx.moveTo(neck.x - 5 * sc, neck.y + 2 * sc)
  ctx.lineTo(neck.x + 5 * sc, neck.y + 2 * sc)
  ctx.lineTo(chest.x + 6.5 * sc, chest.y)
  ctx.lineTo(hips.x + 5.5 * sc, waistY)
  ctx.quadraticCurveTo(hips.x + 9 * sc, hips.y + 8 * sc, hips.x + 7 * sc, hips.y + 18 * sc)
  ctx.lineTo(hips.x - 7 * sc, hips.y + 18 * sc)
  ctx.quadraticCurveTo(hips.x - 9 * sc, hips.y + 8 * sc, hips.x - 5.5 * sc, waistY)
  ctx.lineTo(chest.x - 6.5 * sc, chest.y)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = p.trim
  ctx.lineWidth = Math.max(1, 1.2 * sc)
  ctx.stroke()

  ctx.fillStyle = p.accent
  ctx.beginPath()
  ctx.ellipse(chest.x, waistY, 5.5 * sc, 1.4 * sc, 0, 0, Math.PI * 2)
  ctx.fill()

  for (const side of ['left', 'right'] as const) {
    const knee = joint(joints, `${side}Knee`)
    const ankle = joint(joints, `${side}Ankle`)
    const shoulder = joint(joints, `${side}Shoulder`)
    const elbow = joint(joints, `${side}Elbow`)
    const wrist = joint(joints, `${side}Wrist`)
    if (knee && leftKnee && rightKnee) {
      const hemY = Math.max(leftKnee.y, rightKnee.y) - 6 * sc
      if (knee.y > hemY - 10 * sc) {
        const hip = joint(joints, `${side}Hip`)
        if (hip) drawCapsule(ctx, hip, knee, 2.8 * sc, p.secondary, undefined)
      }
    }
    if (shoulder && elbow) drawCapsule(ctx, shoulder, elbow, 2.4 * sc, p.primary, p.trim)
    if (elbow && wrist) drawCapsule(ctx, elbow, wrist, 2 * sc, p.primary, p.trim)
    if (ankle && knee) drawShoe(ctx, ankle, knee, sc, p.shoe, 'heel')
  }
}

function drawStageSparkle(d: DrawCtx) {
  const { ctx, joints, outfit } = d
  const sc = s(d)
  const p = outfit.palette
  const hips = joint(joints, 'hips')
  const chest = joint(joints, 'chest')
  const neck = joint(joints, 'neck')
  if (!hips || !chest || !neck) return

  drawTorsoPanel(ctx, chest, hips, neck, 7 * sc, p.primary, p.trim)
  ctx.fillStyle = p.secondary
  ctx.beginPath()
  ctx.moveTo(hips.x - 9 * sc, hips.y)
  ctx.lineTo(hips.x + 9 * sc, hips.y)
  ctx.lineTo(hips.x + 7 * sc, hips.y + 10 * sc)
  ctx.lineTo(hips.x - 7 * sc, hips.y + 10 * sc)
  ctx.closePath()
  ctx.fill()

  for (const side of ['left', 'right'] as const) {
    const hip = joint(joints, `${side}Hip`)
    const knee = joint(joints, `${side}Knee`)
    const ankle = joint(joints, `${side}Ankle`)
    const shoulder = joint(joints, `${side}Shoulder`)
    const elbow = joint(joints, `${side}Elbow`)
    const wrist = joint(joints, `${side}Wrist`)
    if (hip && knee) drawCapsule(ctx, hip, knee, 4 * sc, p.secondary, p.accent)
    if (knee && ankle) drawCapsule(ctx, knee, ankle, 3.4 * sc, p.secondary, p.accent)
    if (shoulder && elbow) drawCapsule(ctx, shoulder, elbow, 3.2 * sc, p.primary, p.accent)
    if (elbow && wrist) drawCapsule(ctx, elbow, wrist, 2.8 * sc, p.primary, p.accent)
    if (ankle && knee) drawShoe(ctx, ankle, knee, sc, p.shoe, 'boot')
  }
}

const DRAWERS: Record<string, (d: DrawCtx) => void> = {
  'street-hoodie': drawStreetHoodie,
  'club-tee': drawClubTee,
  'slim-blazer': drawSlimBlazer,
  'evening-dress': drawEveningDress,
  'stage-sparkle': drawStageSparkle,
}

export function drawOutfit(
  ctx: CanvasRenderingContext2D,
  joints: Map<string, SolvedJoint>,
  scale: number,
  outfit: OutfitDefinition,
) {
  const drawer = DRAWERS[outfit.id]
  if (drawer) drawer({ ctx, joints, scale, outfit })
}
