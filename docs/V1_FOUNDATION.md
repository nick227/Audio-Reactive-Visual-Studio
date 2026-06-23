# V1 Foundation Notes

## Goal

Prepare the app for rapid entity implementation while keeping the editor fast and legible.

## Core entities

- `Project`
- `StageEntity`
- `AudioTrackEntity`
- `LayerInstance`
- `AssetTemplate`

All entities include:

- `id`
- `kind`
- `createdAt`
- `updatedAt`

The project includes `schemaVersion: 1` so migrations can be introduced later without guessing.

## Runtime split

React should not own animation frames.

React owns:

- project JSON
- selected layer
- modal visibility
- row control values
- upload/audio file state

The runtime owns:

- requestAnimationFrame updates
- DOM transform application
- audio feature reads
- future canvas/Three.js/GSAP instances

## Layer behavior model

Each row has one required behavior and one optional extra:

```txt
Trigger → selected audio feature
Pulse   → core scale reaction amount
Extra   → secondary subtle effect
```

The final transform is:

```txt
base placement + core pulse + extra effect
```

## Entity expansion path

Add future entities as serializable records first:

- `MediaAssetEntity`
- `UserUploadEntity`
- `TemplatePackEntity`
- `ExportJobEntity`
- `SceneVersionEntity`
- `RenderPresetEntity`

Do not put DOM refs, audio nodes, canvas contexts, GSAP timelines, or Three.js objects inside entities.
