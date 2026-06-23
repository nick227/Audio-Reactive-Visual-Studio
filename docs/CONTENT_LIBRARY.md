# Major Content Library Foundation

This version turns the community library into a studio asset system instead of a small static list.

## What changed

- `assets/registry.ts` now defines a curated studio pack using template factories.
- The library includes 116 user-visible community templates plus the hidden `Photo Cutout` upload template.
- Assets are still safe JSON-backed templates, not arbitrary user code.
- Stage rendering is generic by `settings.visualKind`, so future assets can be added mostly by data.
- The media modal now supports search, category filtering, category counts, and richer previews.

## Categories

1. Images & Cutouts
2. Textures
3. Gradients
4. Particles
5. Shapes
6. Frames
7. Typography
8. Audio Visualizers
9. 3D Objects
10. Motion Effects

## Template shape

Each community asset provides:

- stable `id`
- human-facing `name`
- `category`
- `renderer`
- thumbnail initials
- description
- default placement
- default audio trigger
- default pulse amount
- default extra effect
- safe `settings`

## Runtime contract

The Stage does not hardcode every asset ID. It checks `layer.settings.visualKind` and renders one of the reusable visual families:

- `gradient`
- `texture`
- `particles`
- `shape`
- `frame`
- `typography`
- `audioVisualizer`
- `threeObject`
- `motionEffect`
- `cutout`

This is the foundation for rapid entity implementation: new visual assets can be added as data first, then upgraded into custom renderers only when the effect deserves it.

## Performance guardrails

- Assets render as DOM/CSS layers for v1 content scale.
- Animation-frame transforms still apply imperatively through `Stage.updateFrame`.
- React state is not updated every animation frame.
- The asset list and modal read from the registry, not from custom per-card components.

## Next upgrades

- Promote high-value families to canvas renderers: particles, visualizers, glitch.
- Add template presets with optional `controls` editing in the inspector.
- Add project save/load with schema migration.
- Add lazy preview thumbnails for expensive templates.
- Add community publishing workflow with approval states.
