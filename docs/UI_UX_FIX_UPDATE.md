# UI / UX Fix Update

This patch focuses on immediate editor usability fixes.

## Fixed

- FX Browser tab filtering is now resilient when switching tabs and vibe filters.
- Upload action remains available even when a vibe filter is active.
- Empty FX results now show a proper empty state instead of falling back to an unrelated item.
- FX Browser tab buttons explicitly use `type="button"` to avoid accidental form-style behavior in future wrappers.

## Audio playback

- Audio project state is now set immediately when a user uploads an MP3/WAV.
- The play button becomes available as soon as an audio file is selected, instead of waiting on late metadata handling.
- Metadata still updates duration after the browser loads it.

## Canvas dimensions

Added stage preset toggles:

- Mobile: `1080 × 1920`
- Desktop: `1920 × 1080`
- Film: `2048 × 858`

The default stage is now Mobile.

## Asset fit / fill

The selected-layer inspector now supports:

- Fit / contain
- Fill canvas / cover
- Stretch
- Custom scale
- Center reset

Uploaded image layers now respect the selected fit mode via `object-fit`, so `Fill canvas` actually fills the canvas instead of staying contained.
