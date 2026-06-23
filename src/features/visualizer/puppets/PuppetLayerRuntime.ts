import type { AudioFeatures } from '../audio/audioTypes'
import { TriggerEdgeStore } from './audio/triggerAdapter'
import { getCharacter, type CharacterProfile } from './characters'
import { getFaceKit } from './faces/faceKits'
import { getPuppet } from './registry'
import { PuppetRigSolver } from './rig/PuppetRigSolver'
import { resolveVerticalLayout } from './render/layout'
import { applyStretchToJoints, computePuppetFitLayout } from './render/fitLayout'
import { PuppetRenderer } from './render/PuppetRenderer'
import { DancePlayer } from './sequences/DancePlayer'
import { getDanceSequence, type DanceBias } from './sequences'
import { getSkin } from './skins'
import type { PuppetLayerSettings } from './types'
import type { FitMode } from '../project/types'
import { AutoDanceDirector } from './sequences/autoDance'

function readSettings(raw: Record<string, unknown>): PuppetLayerSettings {
  const characterId = String(raw.characterId ?? 'char-club')
  const char = getCharacter(characterId)
  return {
    visualKind: 'puppet',
    characterId,
    puppetId: String(raw.puppetId ?? 'human-default'),
    danceId: String(raw.danceId ?? char.defaultDanceId),
    skinId: String(raw.skinId ?? char.skinId),
    outfitId: String(raw.outfitId ?? char.outfitId),
    faceKitId: String(raw.faceKitId ?? char.faceKitId),
    autoDance: raw.autoDance !== false && raw.autoDance !== 'false',
    showStage: raw.showStage !== false && raw.showStage !== 'false',
    triggerPreset: (raw.triggerPreset as PuppetLayerSettings['triggerPreset']) ?? char.triggerPreset,
    debug: raw.debug === true || raw.debug === 'true',
  }
}

export class PuppetLayerRuntime {
  private readonly layerId: string
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private settings: PuppetLayerSettings
  private readonly solver: PuppetRigSolver
  private readonly renderer: PuppetRenderer
  private player: DancePlayer
  private readonly triggers = new TriggerEdgeStore()
  private readonly autoDance = new AutoDanceDirector()
  private manualDanceId: string
  private character: CharacterProfile
  private motionBias: DanceBias = { loose: 0, intensity: 0 }
  private fit: FitMode = 'contain'
  private width = 0
  private height = 0

  constructor(layerId: string, canvas: HTMLCanvasElement, rawSettings: Record<string, unknown>) {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Puppet canvas 2d context unavailable')
    this.layerId = layerId
    this.canvas = canvas
    this.ctx = ctx
    this.settings = readSettings(rawSettings)
    this.character = getCharacter(this.settings.characterId)
    this.manualDanceId = this.settings.danceId
    const puppet = getPuppet(this.settings.puppetId)
    this.solver = new PuppetRigSolver(puppet.rig)
    this.renderer = new PuppetRenderer(ctx, getSkin(this.settings.skinId))
    this.applyCharacter(this.character)
    const sequence = getDanceSequence(this.settings.danceId, Date.now(), this.motionBias)
    this.player = new DancePlayer(sequence, puppet.rig)
    this.player.setFaceKitDefaults(getFaceKit(this.settings.faceKitId).defaultExpression)
  }

  updateSettings(rawSettings: Record<string, unknown>) {
    const next = readSettings(rawSettings)
    const charChanged = next.characterId !== this.settings.characterId
    if (charChanged) {
      this.character = getCharacter(next.characterId)
      this.applyCharacter(this.character)
      this.player.setFaceKitDefaults(getFaceKit(this.character.faceKitId).defaultExpression)
    } else {
      if (next.skinId !== this.settings.skinId) this.renderer.setSkin(getSkin(next.skinId))
      if (next.outfitId !== this.settings.outfitId) this.renderer.setOutfit(next.outfitId)
      if (next.faceKitId !== this.settings.faceKitId) {
        this.renderer.setFaceKit(next.faceKitId)
        this.player.setFaceKitDefaults(getFaceKit(next.faceKitId).defaultExpression)
      }
    }
    const manualChanged = next.danceId !== this.manualDanceId
    if (next.autoDance && !this.settings.autoDance) this.autoDance.reset()
    if (!next.autoDance && manualChanged) this.switchDance(next.danceId)
    this.manualDanceId = next.danceId
    this.settings = next
  }

  private applyCharacter(char: CharacterProfile) {
    this.character = char
    this.motionBias = { loose: char.looseBias, intensity: char.intensityBias }
    this.renderer.setSkin(getSkin(char.skinId))
    this.renderer.setOutfit(char.outfitId)
    this.renderer.setFaceKit(char.faceKitId)
    this.autoDance.setDancePool(char.dancePool)
  }

  private switchDance(danceId: string) {
    const snapshot = this.player.getPoseSnapshot()
    const sequence = getDanceSequence(danceId, this.autoDance.getDynamicSeed(), this.motionBias)
    this.player.setSequence(sequence, snapshot ? { transitionFrom: snapshot } : undefined)
  }

  updatePlacement(fit: FitMode) {
    this.fit = fit
  }

  resize(width: number, height: number) {
    if (width < 2 || height < 2) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.canvas.width = Math.round(width * dpr)
    this.canvas.height = Math.round(height * dpr)
    this.canvas.style.width = `${width}px`
    this.canvas.style.height = `${height}px`
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.width = width
    this.height = height
  }

  tick(features: AudioFeatures, deltaMs: number) {
    if (this.width < 2 || this.height < 2) return
    const w = this.width
    const h = this.height
    const triggers = this.triggers.toTriggerFrame(this.layerId, features, this.settings.triggerPreset)

    if (this.settings.autoDance) {
      const nextId = this.autoDance.shouldSwitch(
        deltaMs,
        triggers,
        features,
        this.player.getSequenceId(),
        this.settings.triggerPreset,
      )
      if (nextId) {
        const snapshot = this.player.getPoseSnapshot()
        const sequence = getDanceSequence(nextId, this.autoDance.getDynamicSeed(), this.motionBias)
        this.player.setSequence(sequence, snapshot ? { transitionFrom: snapshot } : undefined)
      }
    }

    const pose = this.player.update(deltaMs, triggers, false)
    const { stageScale, stretchX, stretchY } = computePuppetFitLayout(w, h, this.fit, pose.scale)
    const rootX = w * 0.5 + pose.offset.x * (this.fit === 'stretch' ? stretchX : 1)
    const { rootY, stageY } = resolveVerticalLayout(this.solver, pose, rootX, h, stageScale)
    let joints = this.solver.solve(pose, rootX, rootY, stageScale)
    joints = applyStretchToJoints(joints, rootX, rootY, stretchX, stretchY)

    this.renderer.clear(w, h)
    if (this.settings.showStage) {
      this.renderer.drawStage(w, h, triggers.energy, false, stageY)
    }
    this.renderer.drawPuppet(joints, pose, stageScale * Math.max(stretchX, stretchY))

    if (this.settings.debug) {
      this.drawDebug(joints, triggers)
    }
  }

  dispose() {
    this.triggers.clear(this.layerId)
    this.autoDance.reset()
  }

  private drawDebug(joints: Map<string, import('./types').SolvedJoint>, triggers: import('./types').TriggerFrame) {
    const debug = this.player.getDebugState()
    this.ctx.save()
    this.ctx.font = '10px monospace'
    this.ctx.fillStyle = 'rgba(34,211,238,0.9)'
    this.ctx.fillStyle = 'rgba(248,250,252,0.85)'
    this.ctx.fillText(
      `${this.character.label} | ${debug.sequenceId} | ${debug.poseId}`,
      8,
      14,
    )
    this.ctx.fillText(
      `beat:${triggers.beat} bass:${triggers.bassHit} e:${triggers.energy.toFixed(2)}`,
      8,
      28,
    )
    this.ctx.restore()
  }
}
