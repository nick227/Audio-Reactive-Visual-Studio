import type { FaceState } from '../types'

export type PuppetPoseMap = {
  id: string
  label: string
  rotations?: Record<string, number>
  offset?: { x: number; y: number }
  scale?: number
  face?: Partial<FaceState>
}

export type EaseKind = 'linear' | 'easeInOut' | 'easeOutBack' | 'elasticOut' | 'snap'

export type DanceStep = {
  pose: string
  durationMs: number
  holdMs?: number
  ease?: EaseKind
  accents?: string[]
  advanceOn?: keyof import('../types').TriggerFrame
  beatSnap?: boolean
}

export type DanceMap = {
  schemaVersion: 1
  id: string
  label: string
  loop: boolean
  intensity: number
  loose: number
  reducedMotion?: { sequence: string; intensity: number }
  poses: Record<string, PuppetPoseMap>
  triggerAccents?: Partial<Record<keyof import('../types').TriggerFrame, string[]>>
  steps: DanceStep[]
}
