# Audio Visual Layer V1

A stronger foundation for a lightweight audio-reactive visual editor.

V1 focuses on fast future entity implementation, tighter UI, clearer code boundaries, and lower render overhead.

## What this establishes

- Stacked editor layout: **Stage → Waveform → Assets**
- Entity-oriented project model with `kind`, `id`, timestamps, and `schemaVersion`
- Multiple ordered visual layers; row order controls visual stacking
- Community asset template registry
- Uploaded image layers use the same template/layer system as community assets
- Audio engine based on Web Audio API
- Normalized audio features: `bass`, `beat`, `vocals`, `highs`, `full`
- Core row behavior: selected audio trigger drives layer scale/pulse
- Optional subtle extra effects: float, rotate, drift, shake, glow, flicker, particles
- Imperative stage runtime: animation frames update DOM transforms without pushing every frame through React state
- Throttled UI indicators for waveform progress and audio meter
- Direct stage placement via drag; manual movement switches placement to `custom`
- Compact asset rows: trigger, pulse, extra effect, visibility, stacking, delete
- Selected-layer inspector foundation for fit and size
- Media modal foundation with community assets + user upload manager area

## Run

```bash
npm install
npm run dev
```

Open the local Vite URL, upload an audio file, press play, and tweak asset rows.

## Architecture

```txt
src/features/visualizer/
  audio/       Web Audio analysis and waveform peak building
  assets/      Community asset template registry
  editor/      Stage, waveform, asset list, media modal UI
  entities/    Entity IDs, base entity types, simple entity helpers
  project/     Serializable project/layer/audio/stage types
  runtime/     Transform computation and DOM frame application
```

## Runtime model

```txt
React editor state
  owns project JSON, selected layer, modal state, row controls

Audio engine
  owns AudioContext, analyzer, feature extraction

Stage runtime
  receives audio features on requestAnimationFrame
  updates layer DOM styles imperatively
  avoids React re-rendering 60 times/second

Asset registry
  owns reusable template definitions
  creates layer instances from templates
```

## Key model

```txt
final layer transform = base placement + core audio pulse + optional extra effect
```

The saved project should remain pure JSON. Runtime animation objects, DOM refs, canvas contexts, GSAP timelines, or Three.js scenes should live outside project state.

## Fast entity implementation pattern

New product entities should follow the same shape:

```ts
type SomethingEntity = EntityBase<'something'> & {
  // serializable fields only
}
```

Keep entity creation in small factory functions and keep mutations in project/editor actions. This makes it easy to add `MediaAsset`, `ExportJob`, `TemplatePack`, `UserUpload`, `RenderPreset`, and `SceneVersion` without rewriting the UI.

## Notes

This v1 still intentionally avoids final export/rendering complexity. The priority is a clean product foundation that can absorb Canvas, GSAP, Three.js templates, persistent uploads, and export jobs without collapsing into one giant component.
