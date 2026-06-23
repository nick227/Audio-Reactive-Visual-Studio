# Creative Library Expansion Update

This patch expands the community asset library from a technical catalog into a music-video concept system.

## What changed

- Added `AssetCollection` metadata to asset templates.
- The library is now grouped into 11 musician/DJ-friendly concept collections.
- Search now includes collection names and tags.
- The media modal supports both concept filtering and technical category filtering.
- The registry is still data-first and safe: no arbitrary code execution, only curated template definitions.

## New concept collections

1. Club & DJ
2. Album Art
3. Typography & Titles
4. Visualizers
5. Analog / VHS
6. Psychedelic
7. Rap / Trap
8. Indie / Editorial
9. Branding / Promo
10. 3D Heroes
11. Art Nouveau / Esoteric

## Why this matters

This keeps the runtime simple while making the content layer feel much more useful to musicians:

- faster browsing by vibe
- stronger default templates
- better discoverability for promo use cases
- easier future expansion through data-only registry entries

## Implementation pattern

Every community asset still resolves to the same template contract:

- `id`
- `name`
- `category`
- `collection`
- `tags`
- `renderer`
- `defaultLayer`
- `controls`

That means rapid implementation stays intact: to add more assets later, most work remains content/data work rather than engine work.

## Notes

- `photo-cutout` remains the hidden upload-backed template and is excluded from the grid.
- Existing runtime families remain unchanged: gradient, texture, particles, shape, frame, typography, audioVisualizer, threeObject, motionEffect, and cutout.
- This patch is designed to overlay on top of the v1 content-library build.


## Latest pack

Added an **Art Nouveau / Esoteric** FX pack with abstract, symbolic, bizarre, and eclectic design language for more experimental music-video directions.


## Epic FX Scenes

Added six multi-layer composition templates that insert editable layer bundles instead of single assets. These establish the pattern for complex music-video scenes built from reusable asset templates.
