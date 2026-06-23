# Puppet Layer System — Proposal

## Summary

Add **puppet dancers** as a first-class FX layer type in the audio visualizer editor. Each puppet is a canvas-backed layer instance — not a fullscreen scene — so users can place, scale, duplicate, and stack multiple dancers on stage while reusing the existing layer row controls (trigger, pulse, extra effects, placement).

The puppet runtime is **data-driven**: rig definition → pose maps → dance sequences → FK solver → canvas renderer. New dances and dancer variants are added by registering data files, not by changing render code. See [PUPPET_RECREATION_GUIDE.md](./PUPPET_RECREATION_GUIDE.md) for the portable core.

---

## Goals

| Goal | How |
|------|-----|
| Rapidly add new dances | `*.sequence.ts` file + one registry entry |
| Rapidly add new dancers | `*.rig.ts` + optional `*.skin.ts` + asset template entry |
| Control size per dancer | Existing `placement.scale` on each layer row |
| Multiple dancers on stage | Multiple `LayerInstance` rows, each with its own puppet/dance |
| Audio reactivity | Map `AudioFeatures` → puppet `TriggerFrame`; layer `reaction` for macro pulse |
| Fit existing editor | `visualKind: 'puppet'`, asset registry, FX browser tab, RAF loop |

### Non-goals (V1)

- DOM/CSS limb rendering
- Inverse kinematics or physics
- User-authored dances in the UI (data files only for V1)
- 3D puppet rigs
- Export-time puppet re-render pipeline changes (inherits html2canvas capture like other layers)

---

## Why this fits the app

The editor already separates concerns the puppet system needs:

```
React (project JSON, layer rows, FX browser)
        │
        ▼
Stage RAF loop ──► applyLayerFrame (placement + pulse + extra)
        │
        ▼
Per-layer content (DOM today; canvas for puppets)
```

| App capability | Puppet need |
|----------------|-------------|
| `AudioEngine` + `AudioFeatures` | Beat/bass/highs triggers, energy scalar |
| RAF `updateFrame` in `Stage.tsx` | Per-frame `delta`, trigger read, canvas draw |
| `LayerPlacement` (x, y, scale, rotation) | Stage position + macro size |
| `LayerReaction` (trigger, pulse, extra) | Whole-layer bounce/glow on top of dance motion |
| `assetRegistry` + `createLayerFromTemplate` | One-click add from FX browser |
| Multiple `LayerInstance` rows | Independent dancers, dances, scales |

The puppet guide's `PuppetDancerScene` is ~150 lines of glue. In this app, that glue becomes a **thin canvas layer adapter** — not a standalone fullscreen scene.

---

## Data model

### Layer settings

Extend layer `settings` with a typed puppet block (stored in `Record<string, unknown>` like other visual kinds):

```ts
type PuppetLayerSettings = {
  visualKind: 'puppet'
  puppetId: string      // rig + skin identity, e.g. 'human-default'
  danceId: string       // active sequence, e.g. 'goofyTwoStep'
  skinId: string        // palette override, e.g. 'defaultHuman'
  autoDance: boolean    // audio-driven sequence switching
  showStage: boolean    // draw floor glow inside layer canvas
  triggerPreset: 'tame' | 'vivid' | 'chaos'
  debug?: boolean
}
```

### Asset category

```ts
// project/types.ts
export type AssetCategory =
  | ...
  | 'puppets'   // new

export type AssetCollection =
  | ...
  | 'puppets'   // new FX browser section
```

### Example layer row (UX target)

```txt
[thumb] Puppet Dancer
Trigger [Beat ▼]   Pulse ━━━●━━   Extra [Float ▼]
Dance [Goofy Two Step ▼]   Auto-dance [on]
```

Puppet-specific controls live in the existing **Settings** popover (dance picker, auto-dance toggle, skin, debug). Size uses the existing **scale chip** — no duplicate size slider.

---

## Architecture

### Layer stack (V1)

```txt
stage-layer host (transform from placement + reaction)
  └─ <canvas class="puppet-canvas-layer" />
       ├─ PuppetLayerRuntime (per-layer instance, lives outside React state)
       │    ├─ DancePlayer
       │    ├─ PuppetRigSolver
       │    └─ PuppetRenderer
       └─ (optional) debug overlay
```

**Do not** render limbs as DOM divs. The canvas draws the character centered internally; the host div handles stage placement.

### Frame pipeline (per puppet layer)

Mirrors the recreation guide, adapted for layer-local canvas:

1. **Read context** — canvas `width`/`height` (from layer host box), `deltaMs`, `AudioFeatures`, `reducedMotion` flag.
2. **Map triggers** — `audioFeaturesToTriggerFrame(features, preset)` → `{ beat, bassHit, midsHit, highsHit, chaosHit, energy, brightness }`.
3. **Activate dance** — if `settings.danceId` changed, `player.setSequence(danceId)`.
4. **Auto-dance** (optional) — when `autoDance` on, call sequence picker (ported from scene logic).
5. **Update motion** — `DancePlayer.update(delta, triggers, reducedMotion)` → `ResolvedPose`.
6. **Layout** — `rootX = w * 0.5`, `rootY` from `resolveVerticalLayout()` (center figure in layer canvas).
7. **Solve FK** — `PuppetRigSolver.solve(pose, rootX, rootY, stageScale)`.
8. **Render** — clear canvas, optional stage glow, draw puppet.
9. **Host transform** — existing `applyLayerFrame` scales/moves the whole canvas on stage.

```ts
const stageScale = Math.min(w, h) / 360 * pose.scale
const rootX = w * 0.5 + pose.offset.x
const { rootY, stageY } = resolveVerticalLayout(pose, rootX, h, stageScale)
const joints = solver.solve(pose, rootX, rootY, stageScale)
renderer.drawStage(w, h, triggers.energy, lowPower, stageY)  // if showStage
renderer.drawPuppet(joints, pose, stageScale)
```

### Multiple dancers

Each `LayerInstance` owns its own `PuppetLayerRuntime` (stored in a `Map<layerId, Runtime>` ref on `Stage`, same pattern as future canvas/Three runtimes per V1 foundation notes).

| Layer A | Layer B |
|---------|---------|
| `danceId: 'bounce'` | `danceId: 'robot'` |
| `placement.scale: 0.6` | `placement.scale: 1.1` |
| `placement.x: -200` | `placement.x: 200` |
| `reaction.trigger: 'bass'` | `reaction.trigger: 'beat'` |

No shared global puppet state. Duplicating a layer row = duplicate dancer.

---

## Registries (rapid authoring)

Three small registries keep additions mechanical.

### 1. Puppet registry (`puppets/registry.ts`)

Maps `puppetId` → rig + default skin + metadata.

```ts
export type PuppetDefinition = {
  id: string
  label: string
  rig: RigDefinition          // joint tree from humanRig.ts shape
  defaultSkinId: string
  thumbnail: string
  tags: string[]
}

export const puppetRegistry = new Map<string, PuppetDefinition>([
  ['human-default', { id: 'human-default', label: 'Stick Dancer', rig: humanRig, ... }],
  // future: 'alien', 'robot', 'blob', ...
])
```

**Add a new dancer:** copy rig file, register one entry. Renderer unchanged unless limb count or segment groups differ (rare).

### 2. Dance registry (`puppets/sequences/index.ts`)

Maps `danceId` → `DanceMap` (schema v1 from guide).

```ts
export function getDanceSequence(id: string): DanceMap {
  return danceRegistry.get(id) ?? danceRegistry.get('idle')!
}
```

**Add a new dance:** new `myDance.sequence.ts` + one line in `index.ts`. No renderer or player changes.

### 3. Skin registry (`puppets/skins/index.ts`)

Maps `skinId` → stroke/joint/face palette.

**Add a new look:** new `neonSkin.ts` + registry entry. Same rig, different colors.

### 4. Asset templates (`assets/registry.ts`)

Each browsable puppet is an `AssetTemplate` with `renderer: 'canvas'`:

```ts
studioAsset({
  id: 'puppet-dancer',
  name: 'Puppet Dancer',
  category: 'puppets',
  collection: 'puppets',
  renderer: 'canvas',
  thumbnail: 'PD',
  description: 'Audio-reactive stick figure dancer.',
  tags: ['puppet', 'dancer', 'character'],
  scale: 0.85,
  trigger: 'beat',
  pulseAmount: 0.12,
  extraEffect: 'float',
  settings: {
    visualKind: 'puppet',
    puppetId: 'human-default',
    danceId: 'goofyTwoStep',
    skinId: 'defaultHuman',
    autoDance: false,
    showStage: true,
    triggerPreset: 'vivid',
  },
})
```

Additional templates can ship preset dance/skin combos (e.g. `puppet-robot`, `puppet-bounce`) without new runtime code.

---

## FX browser integration

### New tab: **Puppets**

```ts
// fx/fxLibrary.ts
export type FxTabId = 'mine' | 'text' | 'puppets' | 'community'

export const fxTabs: FxTab[] = [
  { id: 'mine', label: 'Mine' },
  { id: 'text', label: 'Text' },
  { id: 'puppets', label: 'Puppets' },   // new
  { id: 'community', label: 'Community' },
]
```

`puppetItems` — filtered from `communityAssets` where `category === 'puppets'`, or a dedicated `puppetFxItems` list if we want dance-specific cards later.

### Community section

```ts
{ collection: 'puppets', label: 'Puppets' }
```

Preview: animated CSS thumbnail or a tiny looping canvas preview (phase 2). V1 can use initials + tag line like other FX.

---

## Audio bridge

The app's `AudioFeatures` are continuous scalars; the puppet engine expects boolean edge triggers plus `energy`.

### Adapter (`puppets/audio/triggerAdapter.ts`)

```ts
export function audioFeaturesToTriggerFrame(
  features: AudioFeatures,
  prev: TriggerFrame,
  preset: 'tame' | 'vivid' | 'chaos',
): TriggerFrame {
  const thresholds = PRESETS[preset]
  return {
    beat: crossed(features.beat, prev.beat, thresholds.beat),
    bassHit: crossed(features.bass, prev.bass, thresholds.bass),
    midsHit: crossed(features.vocals, prev.vocals, thresholds.mids),
    highsHit: crossed(features.highs, prev.highs, thresholds.highs),
    chaosHit: features.full > thresholds.chaos,
    energy: features.full,
    brightness: features.highs,
  }
}
```

Store `prev` per layer in the runtime instance. Layer `reaction.trigger` / `pulseAmount` remain **macro** effects on the host div (scale bounce), separate from internal dance accents.

---

## File layout

```txt
src/features/visualizer/puppets/
  audio/
    triggerAdapter.ts
  rig/
    humanRig.ts
    PuppetRigSolver.ts
    jointLimits.ts
    armAttach.ts
    types.ts
  poses/
    poseTypes.ts
    basicPoses.ts
    namedAccents.ts
    poseAuthoring.ts
  sequences/
    sequenceTypes.ts
    DancePlayer.ts
    index.ts
    bounce.sequence.ts
    goofyTwoStep.sequence.ts
    robot.sequence.ts
  render/
    PuppetRenderer.ts
    layout.ts              // resolveVerticalLayout, ROOT_TO_STAGE_Y
  skins/
    defaultHumanSkin.ts
    index.ts
  registry.ts              // puppetRegistry
  PuppetLayerRuntime.ts    // per-layer instance (player + solver + renderer)
  types.ts                 // PuppetLayerSettings, TriggerFrame, etc.

src/features/visualizer/editor/
  PuppetCanvasLayer.tsx    // React shell: canvas ref + mount/unmount runtime

src/features/visualizer/runtime/
  puppetRuntimeHost.ts     // Map<layerId, PuppetLayerRuntime>, tick + dispose
```

Port priority from the recreation guide: rig → poses → DancePlayer → renderer → sequences. Skip `PuppetDancerScene.ts` as a class; fold its logic into `PuppetLayerRuntime` + `triggerAdapter`.

---

## Runtime integration points

### 1. `Stage.tsx` — render branch

```ts
case 'puppet':
  return <PuppetCanvasLayer layer={layer} />
```

### 2. `Stage.tsx` — `updateFrame`

After `applyLayerFrame`, tick puppet canvases:

```ts
if (visualKind === 'puppet') {
  puppetRuntimeHost.tick(layer.id, features, deltaMs, time)
}
```

### 3. `PuppetCanvasLayer.tsx`

- On mount: `puppetRuntimeHost.create(layer.id, canvas, layer.settings)`
- On settings change: `puppetRuntimeHost.updateSettings(layer.id, layer.settings)`
- On unmount: `puppetRuntimeHost.dispose(layer.id)`

### 4. `AssetList.tsx` — puppet settings popover

When `visualKind === 'puppet'`, show:
- Dance `<select>` (options from dance registry labels)
- Auto-dance toggle
- Skin `<select>` (optional V1)
- Debug toggle (dev)

### 5. `controlsFor` in registry

```ts
if (category === 'puppets') {
  controls.push(
    { key: 'danceId', label: 'Dance', type: 'select', options: listDanceIds() },
    { key: 'autoDance', label: 'Auto Dance', type: 'select', options: ['false', 'true'] },
  )
}
```

---

## Authoring workflow

### New dance (developer, ~15 min)

1. Copy an existing `*.sequence.ts` as template.
2. Edit `poses` and `steps` (data only).
3. Add `triggerAccents` for beat/bass hits.
4. Register in `sequences/index.ts`.
5. Tune with `debug: true` on a puppet layer — joint labels + step HUD from guide §10.

### New dancer variant (developer, ~30 min)

1. Define new rig in `rig/myRig.ts` (joint tree + lengths).
2. Reuse or fork pose keys if joint ids match; otherwise author pose set.
3. Register in `puppetRegistry`.
4. Add asset template(s) pointing at `puppetId`.

### New skin (developer, ~5 min)

1. New palette object in `skins/`.
2. Register + expose in settings popover.

### User workflow (editor)

1. Open FX browser → **Puppets** tab.
2. Add "Puppet Dancer" (or preset variant).
3. Drag on stage, adjust scale chip, set trigger/pulse.
4. Pick dance from settings popover.
5. Duplicate row for second dancer; change dance + position.

---

## Implementation phases

### Phase 1 — Core port (MVP)

- [ ] Port rig, poses, DancePlayer, renderer, 3–5 sequences
- [ ] `PuppetLayerRuntime` + canvas layer component
- [ ] `puppetRuntimeHost` wired into `Stage.updateFrame`
- [ ] One asset template `puppet-dancer`
- [ ] `visualKind: 'puppet'` render branch
- [ ] Silent-audio idle sway (no track loaded)

**Done when:** one dancer animates on stage, resizes with scale chip, reacts to audio playback.

### Phase 2 — Editor UX

- [ ] Puppets FX tab + community section
- [ ] Dance picker in layer settings popover
- [ ] `audioFeaturesToTriggerFrame` with preset
- [ ] Auto-dance toggle
- [ ] Debug overlay flag

**Done when:** user can add puppet from browser, pick dance, enable auto-dance, see debug HUD.

### Phase 3 — Content expansion

- [ ] Port remaining sequences from source theatre app
- [ ] 2–3 skin variants
- [ ] Preset templates (Bounce Bot, Goofy Two-Step, etc.)
- [ ] Optional: mini canvas preview in FX cards

### Phase 4 — Compositions (optional)

- [ ] `CompositionLayerSeed` presets that spawn 2–3 puppet layers with choreographed placement
- [ ] Micro-events targeting `role: 'lead-dancer'` for flash/jitter

---

## Size and placement semantics

| Control | Scope |
|---------|-------|
| `placement.scale` | Whole dancer on stage (primary user size control) |
| `placement.x/y` | Position on stage |
| `placement.rotation` | Tilt entire dancer |
| `pose.scale` in dance data | Choreography micro-scale (bounce exaggeration) |
| Canvas internal `stageScale` | Auto-fit figure inside layer box (`min(w,h)/360`) |

Recommended defaults for new puppet layers: `fit: 'contain'`, `scale: 0.85`, centered at `x:0, y:0`.

Layer box should fill the stage host area (same as visualizers/particles) so internal centering works; host transform handles stage position.

---

## Persistence and schema

Puppet settings serialize inside existing `LayerInstance.settings` — no project schema bump required for V1.

If we later add user-authored dances:

```ts
// future schemaVersion: 2
export type UserDanceEntity = EntityBase<'user-dance'> & {
  danceMap: DanceMap
}
```

Keep runtime objects (canvas context, DancePlayer instances) **out of** project JSON per V1 foundation rules.

---

## Risks and mitigations

| Risk | Mitigation |
|------|------------|
| RAF cost with many puppet layers | One canvas per layer; skip draw when `!layer.visible`; optional `lowPower` drops stage glow |
| html2canvas export quality | Canvas layers capture cleanly; test multi-puppet exports early |
| Trigger mismatch vs theatre app | Tunable `triggerPreset`; per-layer `prev` frame for edge detection |
| Rig with different joint ids breaks dances | Dances bind to `puppetId`; registry validates joint keys at load |
| Settings popover clutter | Puppet-only controls gated on `visualKind === 'puppet'` |

---

## Success criteria

1. Add puppet from FX browser in &lt; 3 clicks.
2. Two+ dancers on stage with independent dances and scales.
3. New dance shippable with **only** a sequence file + registry line.
4. Audio playback drives accents and step advances perceptibly on beat.
5. No regression to existing DOM layer performance when no puppet layers present.

---

## References

- [PUPPET_RECREATION_GUIDE.md](./PUPPET_RECREATION_GUIDE.md) — rig, DancePlayer, renderer port checklist
- [V1_FOUNDATION.md](./V1_FOUNDATION.md) — React vs runtime split, entity rules
- [FX_BROWSER_UPGRADE.md](./FX_BROWSER_UPGRADE.md) — catalog + tab patterns
