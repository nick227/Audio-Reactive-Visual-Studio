import type { CanvasLayerRenderer } from './types'

const _renderers = new Map<string, CanvasLayerRenderer>()

export function registerRenderer(r: CanvasLayerRenderer): void {
  _renderers.set(r.kind, r)
}

export function getRenderer(kind: string): CanvasLayerRenderer | undefined {
  return _renderers.get(kind)
}

/** Returns the set of visual kinds handled by currently registered renderers. */
export function registeredKinds(): ReadonlySet<string> {
  return new Set(_renderers.keys())
}
