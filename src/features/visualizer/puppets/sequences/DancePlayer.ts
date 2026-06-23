import type { RigDefinition } from '../rig/types'
import { clampJointAngle, lerpJointAngle } from '../rig/jointLimits'
import { namedAccents } from '../poses/namedAccents'
import { namedExpressions } from '../poses/namedExpressions'
import { FaceAnimator } from '../faces/FaceAnimator'
import { lerpResolved, mergeResolved, poseMapToResolved } from '../poses/poseAuthoring'
import type { DanceMap, EaseKind } from '../poses/poseTypes'
import type { ResolvedPose, TriggerFrame } from '../types'
import { defaultFace } from '../types'

type ActiveAccent = {
  id: string
  amount: number
  decayMs: number
}

const LAG_WEIGHTS: Record<string, number> = {
  leftWrist: 1.35,
  rightWrist: 1.35,
  leftElbow: 1.1,
  rightElbow: 1.1,
  leftAnkle: 1.15,
  rightAnkle: 1.15,
  head: 0.75,
}

export class DancePlayer {
  private sequence: DanceMap
  private readonly rig: RigDefinition
  private stepIndex = 0
  private stepElapsed = 0
  private lastAccentStep = -1
  private accents: ActiveAccent[] = []
  private looseAngles: Record<string, number> = {}
  private idlePhase = 0
  private lastResolved: ResolvedPose | null = null
  private transition: { from: ResolvedPose; elapsed: number; duration: number } | null = null
  private readonly faceAnimator = new FaceAnimator()
  private faceKitDefaults: Partial<import('../types').FaceState> = {}

  constructor(sequence: DanceMap, rig: RigDefinition) {
    this.sequence = sequence
    this.rig = rig
    this.resetLoose()
  }

  setSequence(sequence: DanceMap, options?: { transitionFrom?: ResolvedPose }) {
    if (options?.transitionFrom) {
      this.transition = { from: options.transitionFrom, elapsed: 0, duration: 480 }
    }
    this.sequence = sequence
    this.stepIndex = 0
    this.stepElapsed = 0
    this.lastAccentStep = -1
    this.accents = []
    this.faceAnimator.reset()
  }

  setFaceKitDefaults(defaults: Partial<import('../types').FaceState>) {
    this.faceKitDefaults = defaults
  }

  getPoseSnapshot(): ResolvedPose | null {
    return this.lastResolved
  }

  getSequenceId() {
    return this.sequence.id
  }

  getDebugState() {
    const step = this.sequence.steps[this.stepIndex]
    return {
      sequenceId: this.sequence.id,
      stepIndex: this.stepIndex,
      stepElapsed: Math.round(this.stepElapsed),
      poseId: step?.pose ?? '',
      accents: this.accents.map((a) => a.id),
    }
  }

  update(deltaMs: number, triggers: TriggerFrame, reducedMotion: boolean): ResolvedPose {
    const speed = reducedMotion ? 0.55 : 1
    const step = this.sequence.steps[this.stepIndex]
    if (!step) return poseMapToResolved(this.sequence.poses.idle ?? Object.values(this.sequence.poses)[0], this.rig)

    this.captureAccents(triggers, reducedMotion)
    if (!reducedMotion) this.faceAnimator.captureTriggers(triggers, reducedMotion)
    this.tickAccents(deltaMs)

    if (!reducedMotion && step.advanceOn && triggers[step.advanceOn]) {
      this.advanceStep()
    }

    const stepChanged = this.stepIndex !== this.lastAccentStep
    if (stepChanged) {
      this.lastAccentStep = this.stepIndex
      for (const accentId of this.sequence.steps[this.stepIndex]?.accents ?? []) {
        this.pushAccent(accentId)
      }
    }

    this.stepElapsed += deltaMs * speed
    const duration = Math.max(1, step.durationMs)
    const hold = step.holdMs ?? 0
    let progress = Math.max(0, this.stepElapsed - hold) / duration

    if (step.beatSnap && triggers.beat) {
      progress = Math.min(1, progress + 0.18)
    }

    if (progress >= 1) {
      this.advanceStep()
      progress = 0
    }

    const nextStep = this.sequence.steps[this.stepIndex] ?? step
    const fromPose = this.sequence.poses[step.pose]
    const toPose = this.sequence.poses[nextStep.pose]
    const eased = this.ease(progress, nextStep.ease ?? step.ease ?? 'easeInOut')
    let resolved = lerpResolved(
      poseMapToResolved(fromPose, this.rig),
      poseMapToResolved(toPose, this.rig),
      eased,
      this.rig,
    )

    if (!reducedMotion) {
      for (const accent of this.accents) {
        const map = namedAccents[accent.id]
        if (map) {
          resolved = mergeResolved(resolved, map, accent.amount * this.sequence.intensity)
        }
      }
    }

    resolved = this.applyAudioFace(resolved, triggers, reducedMotion, deltaMs)
    resolved = {
      ...resolved,
      face: this.faceAnimator.apply(resolved.face, deltaMs, reducedMotion),
    }
    resolved = this.applyLoose(resolved, deltaMs, this.sequence.loose)
    resolved = this.applyTransition(resolved, deltaMs)
    resolved = this.clampPose(resolved, reducedMotion)
    this.lastResolved = resolved
    return resolved
  }

  private applyTransition(pose: ResolvedPose, deltaMs: number): ResolvedPose {
    if (!this.transition) return pose
    this.transition.elapsed += deltaMs
    const t = Math.min(1, this.transition.elapsed / this.transition.duration)
    const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
    const blended = lerpResolved(this.transition.from, pose, eased, this.rig)
    if (t >= 1) this.transition = null
    return blended
  }

  private captureAccents(triggers: TriggerFrame, reducedMotion: boolean) {
    if (reducedMotion) return
    const map = this.sequence.triggerAccents
    if (!map) return
    for (const key of Object.keys(map) as Array<keyof TriggerFrame>) {
      if (key === 'energy' || key === 'brightness') continue
      if (triggers[key]) {
        for (const accentId of map[key] ?? []) {
          this.pushAccent(accentId)
        }
      }
    }
  }

  private pushAccent(accentId: string) {
    if (namedExpressions[accentId]) {
      this.faceAnimator.push(accentId)
      return
    }
    this.accents.push({ id: accentId, amount: 1, decayMs: accentId === 'chaosStretch' ? 520 : 260 })
  }

  private tickAccents(deltaMs: number) {
    this.accents = this.accents
      .map((accent) => ({ ...accent, amount: accent.amount - deltaMs / accent.decayMs }))
      .filter((accent) => accent.amount > 0)
  }

  private advanceStep() {
    this.stepIndex += 1
    if (this.stepIndex >= this.sequence.steps.length) {
      this.stepIndex = this.sequence.loop ? 0 : this.sequence.steps.length - 1
    }
    this.stepElapsed = 0
  }

  private applyAudioFace(pose: ResolvedPose, triggers: TriggerFrame, reducedMotion: boolean, deltaMs: number): ResolvedPose {
    const face = { ...pose.face }
    this.idlePhase += deltaMs * 0.0015
    const energy = triggers.energy

    if (energy < 0.05) {
      face.pupilX = Math.sin(this.idlePhase * 0.7) * 0.12
      face.pupilY = Math.cos(this.idlePhase * 0.5) * 0.08
      face.mouthOpen = 0.06 + Math.sin(this.idlePhase * 1.2) * 0.04
      face.mouthSmile = 0.1 + Math.sin(this.idlePhase * 0.9) * 0.05
      return { ...pose, face }
    }

    if (triggers.beat) {
      face.leftBrowLift = Math.max(face.leftBrowLift, 0.22)
      face.rightBrowLift = Math.max(face.rightBrowLift, 0.22)
    }
    if (triggers.bassHit) {
      face.mouthOpen = Math.max(face.mouthOpen, 0.28)
      face.pupilY = Math.max(face.pupilY, 0.1)
    }
    if (triggers.highsHit) {
      face.eyeOpen = Math.max(face.eyeOpen, 0.95)
      face.pupilY = Math.min(face.pupilY, -0.08)
    }

    face.mouthOpen = Math.min(reducedMotion ? 0.35 : 0.75, face.mouthOpen + energy * 0.45 + (triggers.beat ? 0.18 : 0))
    face.mouthSmile = Math.min(0.6, face.mouthSmile + triggers.brightness * 0.25)
    face.eyeOpen = Math.min(1, 0.85 + energy * 0.2)
    face.pupilX = (triggers.highsHit ? 0.25 : 0) + Math.sin(this.idlePhase) * 0.08
    face.pupilY = triggers.bassHit ? 0.12 : 0
    if (!reducedMotion && triggers.chaosHit) face.tongue = Math.min(0.5, face.tongue + 0.35)
    return { ...pose, face }
  }

  private applyLoose(pose: ResolvedPose, deltaMs: number, loose: number): ResolvedPose {
    const angles = { ...pose.angles }
    const alpha = 1 - Math.pow(1 - Math.min(0.95, loose), deltaMs / 16.67)
    for (const joint of this.rig.joints) {
      const target = pose.angles[joint.id] ?? joint.angle
      const weight = LAG_WEIGHTS[joint.id] ?? 0.9
      const prev = this.looseAngles[joint.id] ?? target
      this.looseAngles[joint.id] = prev + (target - prev) * alpha / weight
      angles[joint.id] = this.looseAngles[joint.id]
    }
    return { ...pose, angles }
  }

  private clampPose(pose: ResolvedPose, reducedMotion: boolean): ResolvedPose {
    const angles: Record<string, number> = {}
    for (const joint of this.rig.joints) {
      angles[joint.id] = clampJointAngle(joint.id, pose.angles[joint.id] ?? joint.angle)
    }
    const face = { ...defaultFace(), ...this.faceKitDefaults, ...pose.face }
    face.mouthOpen = Math.max(0, Math.min(reducedMotion ? 0.35 : 1, face.mouthOpen))
    face.eyeOpen = Math.max(0.02, Math.min(1, face.eyeOpen))
    if (reducedMotion) face.tongue = 0
    return {
      angles,
      offset: {
        x: pose.offset.x * (reducedMotion ? 0.45 : 1),
        y: pose.offset.y * (reducedMotion ? 0.45 : 1),
      },
      scale: pose.scale,
      face,
    }
  }

  private resetLoose() {
    this.looseAngles = {}
    for (const joint of this.rig.joints) {
      this.looseAngles[joint.id] = joint.angle
    }
  }

  private ease(t: number, kind: EaseKind): number {
    const x = Math.max(0, Math.min(1, t))
    switch (kind) {
      case 'snap':
        return x > 0.92 ? 1 : x * 0.4
      case 'easeOutBack': {
        const c1 = 1.70158
        const c3 = c1 + 1
        return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)
      }
      case 'elasticOut':
        if (x === 0 || x === 1) return x
        return Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1
      case 'linear':
        return x
      case 'easeInOut':
      default:
        return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
    }
  }
}

// exported for pose blending in tests / future use
export { lerpJointAngle }
