# Epic FX Scenes Update

This update adds six complex multi-layer composition templates.

## What changed

- Added `CompositionTemplate`, `CompositionLayerSeed`, and `CompositionMicroEvent` types.
- Added `src/features/visualizer/compositions/registry.ts`.
- Added an Epic FX Scenes mode inside the media modal.
- Added editor support for inserting a composition as multiple normal editable layers.

## Scenes

1. The Oracle Machine
2. Cathedral Rave Window
3. Haunted Zine Wall
4. Astral Disco Relic
5. The Strange Broadcast
6. Floral Circuit Idol

## Product behavior

Epic FX scenes are not opaque effects. Adding one inserts 10–11 normal layers, each with its own placement, trigger, pulse, and extra effect. Users can still reorder, delete, duplicate later, and tune each row normally.

## Architecture

`CompositionTemplate` is a thin bundle over the existing asset template system:

```ts
type CompositionTemplate = {
  id: EntityId
  name: string
  collection: AssetCollection
  thumbnail: string
  description: string
  layerCount: number
  controls: string[]
  microEvents: CompositionMicroEvent[]
  layers: CompositionLayerSeed[]
}
```

The registry exposes:

```ts
epicFxScenes
createLayersFromComposition(compositionId)
```

## Micro-events

The micro-event metadata is included now as choreography design data. The current runtime does not yet execute these events as special timeline logic. That is intentional: the scenes are useful immediately as layered presets, while the data is ready for a later choreography engine.
