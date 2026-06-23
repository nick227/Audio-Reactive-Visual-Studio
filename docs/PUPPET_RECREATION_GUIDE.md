# Puppet Dancer — Recreation Guide

This document explains how `PuppetDancerScene.ts` works and what you need to port the puppet into another application (React, Unity, Godot, plain Canvas, etc.).

The puppet is **not** a sprite or skeletal mesh. It is a **2D forward-kinematics stick figure** driven by numeric pose maps, timed dance sequences, and optional audio triggers.

---

## High-level architecture

`PuppetDancerScene` is a thin orchestrator. It does not animate joints directly. Each frame it wires together four independent layers:

```
Audio / time context
        │
        ▼
┌───────────────────┐
│ PuppetDancerScene │  choose dance, layout on canvas, read triggers
└─────────┬─────────┘
          │
    ┌─────┴─────┬─────────────┬──────────────┐
    ▼           ▼             ▼              ▼
DancePlayer  PuppetRigSolver  PuppetRenderer  (optional debug)
poses        joint x,y        canvas draw
```

| Layer | File | Responsibility |
|-------|------|----------------|
| Scene | `PuppetDancerScene.ts` | Frame loop, dance selection, layout, audio hooks |
| Motion | `sequences/DancePlayer.ts` | Step timing, pose blending, accents, lag |
| Rig | `rig/humanRig.ts` + `rig/PuppetRigSolver.ts` | Skeleton definition, FK joint positions |
| Draw | `render/PuppetRenderer.ts` + `skins/defaultHumanSkin.ts` | Lines, joints, face |
| Data | `poses/*`, `sequences/*.sequence.ts` | Authoring: poses, dances, accents |

To recreate the puppet elsewhere, you need all five concerns. The scene file itself is only ~150 lines of glue code.

---

## Frame pipeline (what `draw()` does)

Every animation frame, `PuppetDancerScene.draw()` runs this sequence:

1. **Read context** — canvas size, elapsed time, delta, reduced-motion flag, audio features.
2. **Activate dance** — ensure `DancePlayer` is playing the selected `DanceMap` (sequence).
3. **Get triggers** — boolean hits (`beat`, `bassHit`, etc.) + scalar `energy` from audio analysis.
4. **Auto-switch dance** (optional) — when `autoDance` is on, pick a new sequence from audio energy.
5. **Update motion** — `DancePlayer.update(delta, triggers)` → `ResolvedPose`.
6. **Layout** — compute `rootX`, `rootY`, `stageScale`, `stageY` so the puppet is centered vertically.
7. **Solve rig** — `PuppetRigSolver.solve(pose, rootX, rootY, scale)` → `Map<jointId, {x,y,angle,radius}>`.
8. **Render** — clear canvas, draw stage glow, draw puppet limbs/joints/face.

Core code path:

```ts
const pose = this.player.update(delta, triggers, reducedMotion)
const stageScale = Math.min(w, h) / 360 * pose.scale
const rootX = w * 0.5 + pose.offset.x
const { rootY, stageY } = this.resolveVerticalLayout(pose, rootX, h, stageScale)
const joints = this.solver.solve(pose, rootX, rootY, stageScale)
this.renderer.drawStage(w, h, energy, lowPower, stageY)
this.renderer.drawPuppet(joints, pose, stageScale)
```

### Key layout constants

| Constant | Value | Meaning |
|----------|-------|---------|
| `ROOT_TO_STAGE_Y` | `126` | Vertical offset from neutral root to stage ellipse (scaled) |
| Base scale divisor | `360` | `stageScale = min(w,h) / 360 * pose.scale` |
| Horizontal center | `w * 0.5` | Puppet root X, plus `pose.offset.x` |
| Stage Y clamp | `34 … height-34` | Keeps floor glow inside canvas |

`resolveVerticalLayout()` solves the rig once at `rootY = 0` to measure vertical bounds, then centers the figure in the viewport:

```ts
const neutralJoints = this.solver.solve(pose, rootX, 0, scale)
const bounds = getVerticalBounds(neutralJoints) // top, bottom, center
const rootY = height * 0.5 - bounds.center + pose.offset.y
const stageY = clamp(neutralRootY + ROOT_TO_STAGE_Y * scale, 34, height - 34)
```

---

## 1. Skeleton (rig)

Defined in `rig/humanRig.ts`. Each joint is a **parent-linked segment** with:

- `id` — unique name
- `parent` — parent joint id (except `root`)
- `length` — segment length in design units (scaled at runtime)
- `angle` — default direction in **degrees** (canvas space: 0° = right, 90° = down)
- `radius` — draw radius for joint dots

### Joint hierarchy

```
root
└─ hips
   ├─ spine → chest → neck → head
   │              ├─ leftShoulder → leftElbow → leftWrist
   │              └─ rightShoulder → rightElbow → rightWrist
   ├─ leftHip → leftKnee → leftAnkle
   └─ rightHip → rightKnee → rightAnkle
```

Face joints (`eyes`, `mouth`, `brows`) exist in the rig but are **not drawn as segments**; the renderer paints facial features on the `head` joint using `pose.face` scalars.

### Forward kinematics (`PuppetRigSolver`)

For each joint in parent order:

```ts
origin = parent ? parent.position : (rootX, rootY)
angleRad = degToRad(pose.angles[joint.id] ?? joint.defaultAngle)
x = origin.x + cos(angleRad) * joint.length * scale
y = origin.y + sin(angleRad) * joint.length * scale
```

This is standard 2D FK. No inverse kinematics. Port by implementing the same loop in your engine's 2D math.

### Joint limits

`rig/jointLimits.ts` clamps arm/leg angles so poses stay plausible. Arms use **absolute canvas angles**, not anatomical bend deltas. Shoulder attachment ranges live in `rig/armAttach.ts`.

When porting, apply the same clamps after pose resolution, or copy `clampJointAngle` / `lerpJointAngle`.

---

## 2. Poses

### Authoring format (`PuppetPoseMap`)

```ts
{
  id: 'bounce',
  label: 'Bounce',
  rotations: { leftKnee: 120, rightKnee: 60, hips: -4, ... },  // degrees per joint
  offset: { x: 0, y: 8 },   // whole-body shift (design units)
  scale: 1.02,              // multiplies stage scale
  face: { mouthOpen: 0.3, pupilX: 0.1, ... }  // optional
}
```

### Resolved runtime pose (`ResolvedPose`)

`DancePlayer` expands sparse maps into a full state:

```ts
{
  angles: Record<jointId, number>,  // every rig joint filled with default or override
  offset: { x, y },
  scale: number,
  face: FaceState  // eyes, mouth, brows, pupils, lips, tongue, etc.
}
```

Pose libraries:

- `poses/basicPoses.ts` — idle, steps, bounce, etc.
- `poses/namedAccents.ts` — short-lived additive bursts (`hipBounce`, `headNod`, `kneeDip`, …)
- `poses/poseAuthoring.ts` — helpers to merge/patch pose maps

---

## 3. Dance sequences (`DanceMap`)

A dance is **data**, not code. Schema version 1 (`sequences/sequenceTypes.ts`):

```ts
{
  schemaVersion: 1,
  id: 'bounce',
  label: 'Bounce',
  loop: true,
  intensity: 1,
  loose: 0.74,                    // joint lag amount (0–1)
  reducedMotion: { sequence: 'goofyTwoStep', intensity: 0.3 },
  poses: { idle: {...}, bounce: {...}, leftStep: {...} },
  triggerAccents: {
    beat: ['hipBounce', 'headNod'],
    bassHit: ['hipBounce', 'kneeDip'],
    // ...
  },
  steps: [
    { pose: 'bounce', durationMs: 220, holdMs: 50, ease: 'easeInOut',
      advanceOn: 'bassHit', accents: ['kneeDip'] },
    // ...
  ]
}
```

### Step fields

| Field | Purpose |
|-------|---------|
| `pose` | Key into `poses` record |
| `durationMs` | Blend time to next step |
| `holdMs` | Pause at start of step before easing |
| `ease` | `linear`, `easeInOut`, `easeOutBack`, `elasticOut`, `snap` |
| `accents` | Named accent ids fired on trigger snap |
| `advanceOn` | Jump step progress when trigger fires |
| `beatSnap` | Nudge step progress on beat |

18+ sequences are registered in `sequences/index.ts`. Adding a dance = new `*.sequence.ts` file + registry entry. Renderer unchanged.

---

## 4. DancePlayer (motion engine)

`DancePlayer.update(deltaMs, triggers, reducedMotion)` returns the final `ResolvedPose`.

### Internal steps

1. **Advance step clock** — `stepElapsed += deltaMs` (slower in reduced motion).
2. **Capture accents** — on trigger edges, push named accent maps with decay timers.
3. **Interpolate poses** — blend current step pose → next step pose using easing curve.
4. **Apply accents** — add rotation/offset/face deltas scaled by accent amount × dance intensity.
5. **Audio face** — procedural eye/mouth motion from triggers (or idle sine drift when silent).
6. **Loose lag** — per-joint exponential smoothing so limbs trail the target (wrists lag most).
7. **Clamp** — joint limits + face ranges.

### Easing functions

Implemented in `DancePlayer.ease()`: snap threshold, cubic ease-in-out, ease-out-back overshoot, elastic-out wobble.

### Accent decay

Each accent has `decayMs` (260ms default, 520ms for `chaosStretch`). Amount decreases linearly: `amount -= deltaMs / decayMs`.

### Reduced motion

When enabled: accents disabled, smaller offsets, capped mouth, no tongue, slower step speed, may swap to a calmer fallback sequence via `reducedMotion.sequence`.

---

## 5. Renderer (`PuppetRenderer`)

Canvas 2D stick figure. Draw order matters (no z-buffer):

1. Shadow lines (hips → each ankle, thick dark stroke)
2. Torso segments
3. Leg segments
4. Torso/leg joint dots (behind arms)
5. Arm segments (in front of torso)
6. Arm joint dots + head dot
7. Face on head (eyes, brows, mouth)

### Segment groups

```ts
TORSO: hips-spine, spine-chest, chest-neck, neck-head
ARMS:  shoulder-elbow, elbow-wrist  (chest→shoulder stubs hidden)
LEGS:  hips-hip, hip-knee, knee-ankle
```

Stroke width: `max(3, 7 * scale)`.

### Face (drawn relative to head joint)

All face params are **normalized scalars** mapped to pixel offsets × `scale`:

- `eyeOpen` — lid closure (0 = shut, 1 = wide)
- `pupilX`, `pupilY` — pupil offset inside eye (−1…1)
- `leftBrowLift`, `rightBrowLift`, `leftBrowRotate`, `rightBrowRotate`
- `mouthOpen`, `mouthSmile`, `topLipY`, `bottomLipY`, `tongue`

### Skin palette (`defaultHumanSkin`)

```ts
{ line: '#f8fafc', joint: '#facc15', face: '#fef3c7',
  accent: '#22d3ee', shadow: 'rgba(0,0,0,0.35)' }
```

Stage: dark vertical gradient + cyan floor ellipse + optional spotlight lines (skipped in `lowPower` mode).

---

## 6. Audio integration (optional but built-in)

The scene expects a theatre-style `AnimationContext` with:

```ts
context.shared.time.elapsed   // ms
context.shared.time.delta     // ms since last frame
context.shared.features       // FFT bands, flux, centroid, env
context.shared.getTriggers(preset)  // or fallback getVisualTriggers()
context.shared.reducedMotion
context.shared.lowPower
context.options.sequence      // dance id string
context.options.preset        // 'tame' | 'vivid' | 'chaos'
```

### TriggerFrame shape

```ts
{
  beat: boolean,
  bassHit: boolean,
  midsHit: boolean,
  highsHit: boolean,
  chaosHit: boolean,
  energy: number,      // 0–1
  brightness: number,  // 0–1
}
```

### Auto dance switching

`updateAutoDance()` switches sequences when:

- `chaosHit`, or
- `beat` + (flux spike or 18% random), or
- `bassHit` + bass flux, or
- `highsHit` + highs flux, or
- sustained energy + 1.4% random

Cooldown: ~1.25–3.85s between switches, ~180–540ms rest after switch. Uses `pickAutoDanceSequenceId()` pools (calm / bassy / bright / busy / wild) or procedural `dynamicRandom`.

**Without audio:** pass a static `TriggerFrame` with all hits `false` and low `energy`. The player falls back to idle pose sway when audio is idle.

---

## 7. Minimal port checklist

### Files to copy or reimplement

| Priority | Path | Notes |
|----------|------|-------|
| Required | `rig/humanRig.ts` | Skeleton definition |
| Required | `rig/PuppetRigSolver.ts` | FK solver (~30 lines) |
| Required | `rig/jointLimits.ts`, `rig/armAttach.ts` | Angle clamps |
| Required | `poses/poseTypes.ts` | Type contracts |
| Required | `poses/basicPoses.ts` | Base poses |
| Required | `poses/namedAccents.ts` | Trigger accents |
| Required | `sequences/DancePlayer.ts` | Motion engine |
| Required | `sequences/sequenceTypes.ts` | Dance schema |
| Required | `render/PuppetRenderer.ts` | Drawing (or reimplement in your renderer) |
| Required | `skins/defaultHumanSkin.ts` | Colors |
| Optional | `sequences/*.sequence.ts` | Individual dances |
| Optional | `sequences/dynamicRandom.sequence.ts` | Procedural dance |
| Optional | `PuppetDancerScene.ts` | Only if you want auto-dance + theatre wiring |

### Minimal game loop (pseudocode)

```ts
const rig = humanRig
const solver = new PuppetRigSolver(rig)
const player = new DancePlayer(getDanceSequence('twoStep'), rig)
const renderer = new PuppetRenderer(ctx, defaultHumanSkin)

function frame(deltaMs: number) {
  const triggers = { beat: false, bassHit: false, midsHit: false,
    highsHit: false, chaosHit: false, energy: 0, brightness: 0 }

  const pose = player.update(deltaMs, triggers, false)

  const w = canvas.width, h = canvas.height
  const scale = Math.min(w, h) / 360 * pose.scale
  const rootX = w * 0.5 + pose.offset.x
  const rootY = h * 0.5 + pose.offset.y  // simplified; use resolveVerticalLayout for centering

  const joints = solver.solve(pose, rootX, rootY, scale)

  ctx.clearRect(0, 0, w, h)
  renderer.drawStage(w, h, 0.2, false, h * 0.78)
  renderer.drawPuppet(joints, pose, scale)
}

requestAnimationFrame(loop)
```

### Porting to other renderers

| Target | Approach |
|--------|----------|
| **Canvas 2D** | Use `PuppetRenderer` as-is |
| **SVG** | Emit `<line>` / `<circle>` from solved joints each frame |
| **WebGL / Three.js** | `Line2` or mesh quads between joint pairs; head as circle mesh |
| **Unity 2D** | `LineRenderer` components or `Sprite` bones at joint positions |
| **Godot** | `Line2D` nodes + `draw_circle` in `_draw()` on a `Node2D` |
| **CSS** | Possible but awkward; rotate `div` segments with `transform-origin` at parent joint |

The **portable core** is: `ResolvedPose` → FK solver → list of segment endpoints. Rendering is swappable.

### Porting to 3D

Keep the same pose angles but project to a billboard plane, or map 2D angles to simplified 3D bone rotations on a frontal rig. The authored angles are 2D canvas directions, not Euler triplets — expect manual remapping for true 3D skeletons.

---

## 8. Scene initialization & options

```ts
class PuppetDancerScene extends CanvasAnimation {
  constructor() {
    super({ defaultOpacity: 1, defaultBlendMode: 'normal', defaultZIndex: 101 })
  }

  async init(container, context) {
    await super.init(container, context)  // creates fullscreen <canvas>
    this.renderer = new PuppetRenderer(this.ctx, defaultHumanSkin)
    this.selectedDanceId = context.options?.sequence ?? 'dynamicRandom'
    this.activateDance(id, reducedMotion, true)
  }
}
```

| Option | Effect |
|--------|--------|
| `sequence` | Dance id (`bounce`, `robot`, `dynamicRandom`, …) |
| `preset` | Audio trigger sensitivity (`tame`, `vivid`, `chaos`) |
| `reducedMotion` | Calmer motion, accent suppression |
| `debug` / `theatreDev` | Overlay joint labels + pose/trigger HUD |

Factory export for theatre registry:

```ts
export function puppetDancerFactory(): IAnimation {
  return new PuppetDancerScene()
}
```

---

## 9. Coordinate system notes

- **Y increases downward** (standard canvas).
- Angles are **absolute segment directions**, not relative bend amounts (except blending uses special arm interpolation via `lerpJointAngle`).
- Default rig pose faces forward with arms slightly out; `-90°` on spine/chest/neck/head means "up" in rest pose.
- Design units are arbitrary; only the ratio `min(w,h)/360` maps them to screen pixels.

---

## 10. Debug authoring

Set `debug: true` on the layer to render:

- Joint id labels at each solved position
- Current sequence / pose / step index / elapsed ms
- Active accent ids
- Live trigger flags
- Resolved offset, scale, face scalars

Use this when tuning new `DanceMap` files without reading numeric pose data blindly.

---

## Summary

`PuppetDancerScene.ts` is an orchestrator, not the puppet itself. To recreate the character:

1. Define the **rig** (joint tree + lengths + default angles).
2. Author **poses** and **dance steps** as JSON-like maps.
3. Run **DancePlayer** each frame to produce a `ResolvedPose`.
4. **Solve FK** to get joint `(x, y)` positions.
5. **Draw** segments and a procedural face.

The motion quality comes from `DancePlayer` (easing, accents, lag, audio face), not from the scene file. Copy that module and the pose/sequence data to get 90% of the behavior in another app; reimplement only the renderer and your preferred input loop.
