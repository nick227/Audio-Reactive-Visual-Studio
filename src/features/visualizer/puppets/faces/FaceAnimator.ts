import type { FaceState, TriggerFrame } from '../types'
import { mergeFaceState, namedExpressions } from '../poses/namedExpressions'

type ActiveExpression = {
  id: string
  amount: number
  decayMs: number
}

type BlinkPhase = 'idle' | 'closing' | 'closed' | 'opening'

export class FaceAnimator {
  private expressions: ActiveExpression[] = []
  private blinkPhase: BlinkPhase = 'idle'
  private blinkElapsed = 0
  private nextBlinkIn = 3200 + Math.random() * 2400
  private blinkCloseMs = 90
  private blinkHoldMs = 50
  private blinkOpenMs = 110

  reset() {
    this.expressions = []
    this.blinkPhase = 'idle'
    this.blinkElapsed = 0
    this.nextBlinkIn = 3200 + Math.random() * 2400
  }

  captureTriggers(triggers: TriggerFrame, reducedMotion: boolean) {
    if (reducedMotion) return
    if (triggers.chaosHit) this.push('oFace', 520)
    else if (triggers.beat) this.push(Math.random() > 0.55 ? 'browFlash' : 'bigGrin', 240)
    else if (triggers.bassHit) this.push(Math.random() > 0.4 ? 'jawDrop' : 'bassWink', 300)
    else if (triggers.highsHit) this.push('wideEyes', 260)
    else if (triggers.midsHit && Math.random() > 0.6) this.push('smirk', 280)
  }

  push(id: string, decayMs = 280) {
    if (!namedExpressions[id]) return
    this.expressions.push({ id, amount: 1, decayMs })
  }

  apply(face: FaceState, deltaMs: number, reducedMotion: boolean): FaceState {
    this.tickExpressions(deltaMs)
    if (!reducedMotion) this.tickBlink(deltaMs)

    let result = { ...face }
    for (const expr of this.expressions) {
      const patch = namedExpressions[expr.id]
      if (patch) result = mergeFaceState(result, patch, expr.amount)
    }

    if (!reducedMotion && this.blinkPhase !== 'idle') {
      result.eyeOpen = Math.min(result.eyeOpen, this.blinkEyeOpen())
    }

    return result
  }

  private tickExpressions(deltaMs: number) {
    this.expressions = this.expressions
      .map((e) => ({ ...e, amount: e.amount - deltaMs / e.decayMs }))
      .filter((e) => e.amount > 0)
  }

  private tickBlink(deltaMs: number) {
    if (this.blinkPhase === 'idle') {
      this.nextBlinkIn -= deltaMs
      if (this.nextBlinkIn <= 0) {
        this.blinkPhase = 'closing'
        this.blinkElapsed = 0
      }
      return
    }

    this.blinkElapsed += deltaMs
    const total = this.blinkCloseMs + this.blinkHoldMs + this.blinkOpenMs

    if (this.blinkElapsed < this.blinkCloseMs) {
      this.blinkPhase = 'closing'
    } else if (this.blinkElapsed < this.blinkCloseMs + this.blinkHoldMs) {
      this.blinkPhase = 'closed'
    } else if (this.blinkElapsed < total) {
      this.blinkPhase = 'opening'
    } else {
      this.blinkPhase = 'idle'
      this.blinkElapsed = 0
      this.nextBlinkIn = 2800 + Math.random() * 3200
    }
  }

  private blinkEyeOpen(): number {
    const t = this.blinkElapsed
    if (this.blinkPhase === 'closing') {
      return 1 - t / this.blinkCloseMs
    }
    if (this.blinkPhase === 'closed') {
      return 0.04
    }
    if (this.blinkPhase === 'opening') {
      const openT = t - this.blinkCloseMs - this.blinkHoldMs
      return openT / this.blinkOpenMs
    }
    return 1
  }
}
