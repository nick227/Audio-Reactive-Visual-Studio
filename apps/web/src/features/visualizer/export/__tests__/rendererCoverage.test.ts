import { describe, it, expect } from 'vitest'
import '../renderers/index'                   // populate registry (side effect)
import { registeredKinds } from '../renderers/registry'
import {
  ALL_VISUAL_KINDS,
  MODIFIER_KINDS,
  UNSUPPORTED_KINDS,
  validateRendererCoverage,
} from '../renderers/knownKinds'

describe('renderer coverage', () => {
  it('every kind in ALL_VISUAL_KINDS is classified in exactly one bucket', () => {
    const report = validateRendererCoverage(registeredKinds())

    expect(
      report.unclassified,
      `Unclassified kinds — add to renderers/index.ts, MODIFIER_KINDS, or UNSUPPORTED_KINDS:\n  ${report.unclassified.join(', ')}`,
    ).toEqual([])

    expect(
      report.conflicts,
      `Kinds in multiple buckets — each kind must appear in exactly one:\n  ${report.conflicts.join(', ')}`,
    ).toEqual([])

    expect(report.ok).toBe(true)
  })

  it('UNSUPPORTED_KINDS have non-empty reasons', () => {
    for (const [kind, reason] of UNSUPPORTED_KINDS) {
      expect(reason, `"${kind}" is missing an unsupported reason`).toBeTruthy()
      expect(reason.length, `"${kind}" reason is too short`).toBeGreaterThan(10)
    }
  })

  it('MODIFIER_KINDS and UNSUPPORTED_KINDS are subsets of ALL_VISUAL_KINDS', () => {
    for (const kind of MODIFIER_KINDS) {
      expect(ALL_VISUAL_KINDS.has(kind), `modifier "${kind}" not in ALL_VISUAL_KINDS`).toBe(true)
    }
    for (const kind of UNSUPPORTED_KINDS.keys()) {
      expect(ALL_VISUAL_KINDS.has(kind), `unsupported "${kind}" not in ALL_VISUAL_KINDS`).toBe(true)
    }
  })

  it('registered kinds are a subset of ALL_VISUAL_KINDS', () => {
    const unknown: string[] = []
    for (const kind of registeredKinds()) {
      if (!ALL_VISUAL_KINDS.has(kind)) unknown.push(kind)
    }
    expect(
      unknown,
      `Registered kinds not in ALL_VISUAL_KINDS — add them:\n  ${unknown.join(', ')}`,
    ).toEqual([])
  })
})
