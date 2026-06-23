import type { AudioFeatures } from '../../audio/audioTypes'
import type { TriggerFrame, TriggerPreset } from '../types'

function pickFromList(pool: string[], currentId: string, roll: number): string {
  const baseId = currentId.split('-')[0]
  const options = pool.filter((id) => id !== currentId && id !== baseId)
  const list = options.length ? options : pool
  return list[Math.floor(roll * list.length) % list.length]
}

export class AutoDanceDirector {
  private cooldownMs = 1800
  private restMs = 0
  private prevBass = 0
  private prevHighs = 0
  private idleMs = 0
  private randomSeed = Math.floor(Math.random() * 1e9)
  private dancePool: string[] = ['shuffle', 'armWave', 'bounce', 'goofyTwoStep']

  setDancePool(pool: string[]) {
    this.dancePool = pool.length ? pool : this.dancePool
  }

  reset() {
    this.cooldownMs = 1800
    this.restMs = 0
    this.prevBass = 0
    this.prevHighs = 0
    this.idleMs = 0
  }

  shouldSwitch(
    deltaMs: number,
    triggers: TriggerFrame,
    features: AudioFeatures,
    currentId: string,
    preset: TriggerPreset,
  ): string | null {
    this.cooldownMs = Math.max(0, this.cooldownMs - deltaMs)
    this.restMs = Math.max(0, this.restMs - deltaMs)
    this.idleMs += deltaMs

    const bassFlux = features.bass - this.prevBass
    const highsFlux = features.highs - this.prevHighs
    this.prevBass = features.bass
    this.prevHighs = features.highs

    if (this.cooldownMs > 0 || this.restMs > 0) return null

    const roll = Math.random()
    const chaosBias = preset === 'chaos' ? 1.45 : preset === 'tame' ? 0.65 : 1
    let fire = false

    if (triggers.chaosHit) fire = true
    else if (triggers.beat && (bassFlux > 0.05 || roll < 0.2 * chaosBias)) fire = true
    else if (triggers.bassHit && bassFlux > 0.04) fire = true
    else if (triggers.highsHit && highsFlux > 0.04) fire = true
    else if (triggers.energy > 0.35 && roll < 0.016 * chaosBias) fire = true
    else if (triggers.energy < 0.06 && this.idleMs > 4000 && roll < 0.38) fire = true
    else if (this.idleMs > 7500 && roll < 0.25) fire = true

    if (!fire) return null

    const nextId = pickFromList(this.dancePool, currentId, roll)
    this.cooldownMs = 1200 + roll * 2400
    this.restMs = 160 + roll * 340
    this.idleMs = 0
    if (nextId === 'dynamicRandom') this.randomSeed = (this.randomSeed * 1664525 + 1013904223) >>> 0
    return nextId
  }

  getDynamicSeed() {
    return this.randomSeed
  }
}
