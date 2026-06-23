import type { AudioFeatures } from '../audio/audioTypes'
import { silentAudioFeatures } from '../audio/audioTypes'
import type { CompositionMicroEvent } from '../project/types'

export type ActiveMicroEffect = {
  effect: CompositionMicroEvent['effect']
  progress: number
}

type ActiveEvent = {
  effect: CompositionMicroEvent['effect']
  startTime: number
  duration: number
}

const EFFECT_DURATIONS: Record<CompositionMicroEvent['effect'], number> = {
  flash: 180,
  burst: 280,
  jitter: 320,
  invert: 200,
  wipe: 240,
  duplicate: 200,
}

export class MicroEventEngine {
  private cooldowns = new Map<string, number>()
  private activeByRole = new Map<string, ActiveEvent>()
  private prevFeatures: AudioFeatures = silentAudioFeatures

  tick(features: AudioFeatures, time: number, events: CompositionMicroEvent[]): Map<string, ActiveMicroEffect> {
    const result = new Map<string, ActiveMicroEffect>()

    for (const [role, active] of this.activeByRole) {
      const elapsed = time - active.startTime
      if (elapsed >= active.duration) {
        this.activeByRole.delete(role)
      } else {
        result.set(role, { effect: active.effect, progress: elapsed / active.duration })
      }
    }

    for (const event of events) {
      if (this.shouldFire(event, features, time)) {
        this.cooldowns.set(event.id, time + event.cooldownMs)
        const entry: ActiveEvent = { effect: event.effect, startTime: time, duration: EFFECT_DURATIONS[event.effect] }
        this.activeByRole.set(event.targetRole, entry)
        result.set(event.targetRole, { effect: event.effect, progress: 0 })
      }
    }

    this.prevFeatures = features
    return result
  }

  private shouldFire(event: CompositionMicroEvent, features: AudioFeatures, time: number): boolean {
    const cooldownExpiry = this.cooldowns.get(event.id) ?? 0
    if (time < cooldownExpiry) return false
    if (Math.random() > event.probability) return false
    return this.checkTrigger(event.trigger, features)
  }

  private checkTrigger(trigger: CompositionMicroEvent['trigger'], features: AudioFeatures): boolean {
    switch (trigger) {
      case 'strongBeat': return features.beat > 0.65
      case 'bassPeak': return features.bass > 0.72 && features.bass > this.prevFeatures.bass + 0.18
      case 'highSpark': return features.highs > 0.7
      case 'randomInterval': return true
    }
  }
}
