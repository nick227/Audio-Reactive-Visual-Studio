import type { LayerInstance } from '../project/types'
import { resolveVisualKind } from '../runtime/layerVisualKind'
import { registeredKinds } from './renderers/registry'
import { MODIFIER_KINDS, UNSUPPORTED_KINDS } from './renderers/knownKinds'

// ── Diagnostics ───────────────────────────────────────────────────────────────

export interface RendererDiagnostics {
  readonly mode: 'native' | 'compat'
  /** Number of visible layers that can be rendered natively (includes modifiers). */
  readonly supportedLayers: number
  readonly totalLayers: number
  /** Visual kinds that triggered compat fallback, deduplicated. */
  readonly unsupportedKinds: readonly string[]
  /** Human-readable sentence explaining the fallback, or null in native mode. */
  readonly fallbackReason: string | null
}

export function analyzeRendererSupport(layers: LayerInstance[]): RendererDiagnostics {
  const kinds   = registeredKinds()
  const visible = layers.filter((l) => l.visible)
  const unsupported = new Set<string>()

  for (const layer of visible) {
    const vk = resolveVisualKind(layer)
    if (MODIFIER_KINDS.has(vk)) continue   // handled by render loop
    if (kinds.has(vk)) continue            // registered renderer
    unsupported.add(vk)

    // Dev guard: warn on kinds that aren't even declared unsupported.
    // This means someone added a new visualKind without updating knownKinds.ts.
    if (import.meta.env.DEV && !UNSUPPORTED_KINDS.has(vk)) {
      console.error(
        `[Canvas Renderer] Unknown visual kind "${vk}" on layer "${layer.id}" (templateId: "${layer.templateId}").`,
        'Add it to ALL_VISUAL_KINDS in renderers/knownKinds.ts and classify it.',
      )
    }
  }

  const mode: 'native' | 'compat' = unsupported.size === 0 ? 'native' : 'compat'
  const unsupportedKinds = [...unsupported]

  let fallbackReason: string | null = null
  if (mode === 'compat' && unsupportedKinds.length > 0) {
    // Use the declared reason for the first unsupported kind, if available.
    const primary = unsupportedKinds[0]
    const declared = UNSUPPORTED_KINDS.get(primary)
    if (declared && unsupportedKinds.length === 1) {
      fallbackReason = declared
    } else {
      const label = unsupportedKinds.length === 1
        ? `"${primary}" layers are`
        : `${unsupportedKinds.map((k) => `"${k}"`).join(', ')} layers are`
      fallbackReason = `${label} not yet supported by Canvas Native`
    }
  }

  return {
    mode,
    supportedLayers: visible.length - unsupported.size,
    totalLayers: visible.length,
    unsupportedKinds,
    fallbackReason,
  }
}

export function canUseNativeRenderer(layers: LayerInstance[]): boolean {
  return analyzeRendererSupport(layers).mode === 'native'
}
