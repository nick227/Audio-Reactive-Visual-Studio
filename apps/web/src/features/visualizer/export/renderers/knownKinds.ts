/**
 * Authoritative registry of every visual kind the layer system can produce.
 *
 * When adding a new visualKind anywhere in the codebase:
 *   1. Add it to ALL_VISUAL_KINDS below.
 *   2. Classify it in exactly one of:
 *        a. registerRenderer() in renderers/index.ts   → canvas-native
 *        b. MODIFIER_KINDS                             → full-frame compositing
 *        c. UNSUPPORTED_KINDS                          → intentional compat fallback (reason required)
 *   3. `pnpm test` enforces the rule — it will fail until all three sets are consistent.
 *
 * No kind may appear in more than one classification.
 */

// ── Complete set ──────────────────────────────────────────────────────────────

export const ALL_VISUAL_KINDS = new Set<string>([
  // Canvas renderers (registered in renderers/index.ts)
  'cutout',
  'video',
  'gradient',
  'shape',
  'typography',
  'subtitle',
  'audioVisualizer',
  'particles',
  'texture',
  'frame',
  // Full-frame compositing modifiers (handled by render loop, not a renderer)
  'motionEffect',
  // Intentional compat fallback — separate rendering systems
  'puppet',
  'threeObject',
  // Fallback for unrecognized templateIds from layerVisualKind.ts:fallbackKind
  'unknown',
])

// ── Modifiers ─────────────────────────────────────────────────────────────────
// Kinds handled by the render loop as full-frame compositing operations.
// They are always treated as native — never trigger compat fallback.

export const MODIFIER_KINDS = new Set<string>([
  'motionEffect',
])

// ── Explicitly unsupported ────────────────────────────────────────────────────
// Kinds that intentionally fall back to html2canvas compatibility mode.
// A reason is required — it surfaces in RendererDiagnostics.fallbackReason.

export const UNSUPPORTED_KINDS = new Map<string, string>([
  [
    'puppet',
    'Puppet layers use a separate skeletal animation system — port PuppetRenderer to canvas before enabling native export',
  ],
  [
    'threeObject',
    'Three.js objects require a WebGL context — incompatible with 2D canvas export',
  ],
  [
    'unknown',
    'Unrecognized templateId — add a visualKind to the layer settings or handle the templateId in layerVisualKind.ts',
  ],
])

// ── Validation ────────────────────────────────────────────────────────────────

export interface CoverageReport {
  ok: boolean
  /** Kinds in ALL_VISUAL_KINDS that are not in any classification bucket. */
  unclassified: string[]
  /** Kinds that appear in more than one classification. */
  conflicts: string[]
}

/**
 * Returns a coverage report verifying every kind in ALL_VISUAL_KINDS is classified
 * in exactly one of: registered renderers, modifiers, or unsupported.
 *
 * Called by rendererCoverage.test.ts. Throws on `!ok` only if you wrap it yourself.
 */
export function validateRendererCoverage(registeredKinds: ReadonlySet<string>): CoverageReport {
  const unclassified: string[] = []
  const conflicts: string[] = []

  for (const kind of ALL_VISUAL_KINDS) {
    const inRegistry    = registeredKinds.has(kind)
    const isModifier    = MODIFIER_KINDS.has(kind)
    const isUnsupported = UNSUPPORTED_KINDS.has(kind)
    const count = (inRegistry ? 1 : 0) + (isModifier ? 1 : 0) + (isUnsupported ? 1 : 0)

    if (count === 0) unclassified.push(kind)
    if (count >  1) conflicts.push(kind)
  }

  return { ok: unclassified.length === 0 && conflicts.length === 0, unclassified, conflicts }
}
