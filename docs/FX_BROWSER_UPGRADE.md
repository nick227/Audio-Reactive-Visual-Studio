# FX Browser Upgrade

This update turns the add modal into a cinematic FX browser and introduces a reusable FX catalog layer for the future full-page library experience.

## Core product decision

`FX` now means anything that can become a layer on the canvas:

- uploads
- images
- drawings / cutouts
- textures
- gradients
- shapes
- frames
- typography
- particles
- visualizers
- 3D objects
- motion FX
- Epic FX scenes

## What changed

- Added `fx/fxLibrary.ts` as a unified catalog source.
- Rebuilt the modal as **FX Browser** instead of media picker.
- Added many type tabs instead of a small set of broad modes.
- Added cinematic rectangle cards with title + description stacks.
- Added a selected-item preview rail for larger previews and add actions.
- Added concept/vibe filters that work across all FX types.
- Added `FxLibraryPage.tsx` as a dedicated full-page catalog surface.
- Added an **FX Library** button to the editor top bar.

## Browser model

The modal is for fast in-project adding:

- search
- type tabs
- vibe filters
- rectangle FX cards
- selected preview panel
- upload image shortcut
- add asset or scene

The FX Library page is for discovery:

- larger hero surface
- left rail categories
- featured FX card
- bigger catalog grid
- future favorites / upload management / FX details

## Preview strategy

Every FX item now has lightweight preview metadata. It does not require every item to have a real thumbnail immediately.

Priority order:

1. real uploaded/image thumbnail
2. curated poster thumbnail
3. generated CSS thumbnail
4. animated hover treatment
5. initials fallback

## Files

- `src/features/visualizer/fx/fxLibrary.ts`
- `src/features/visualizer/editor/MediaModal.tsx`
- `src/features/visualizer/editor/FxLibraryPage.tsx`
- `src/features/visualizer/editor/VisualizerEditor.tsx`
- `src/styles/global.css`
