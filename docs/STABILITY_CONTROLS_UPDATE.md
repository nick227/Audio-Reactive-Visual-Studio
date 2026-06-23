# Stability + Controls Update

This patch addresses the highest-impact issues from the system design review without changing the core editor model.

## Fixed

- Object URLs are now tracked and revoked.
  - Replaces old audio blob URL when a new audio file is uploaded.
  - Revokes uploaded-image blob URLs when the layer is removed.
  - Revokes any remaining managed object URLs when the editor unmounts.

- Asset-specific controls are now rendered in the inspector.
  - `AssetTemplate.controls` is no longer dead data.
  - Supports `color`, `slider`, `select`, and `text` controls.
  - Edits write into `layer.settings` and update the stage immediately.

- Stage dragging now uses canvas coordinate scaling.
  - Placement x/y are treated as virtual canvas coordinates.
  - Pointer deltas are scaled by the displayed stage size versus the selected canvas dimensions.

- Layer frame application now positions layers by canvas-relative percentages.
  - This makes placement more portable across Mobile, Desktop, and Film stage presets.

- `defaultProject` now has a real factory.
  - `createDefaultProject()` generates fresh IDs and timestamps.
  - The old `defaultProject` export remains for compatibility.

- Added localStorage project autosave/load.
  - Saves serializable project state automatically.
  - Runtime `blob:` URLs are stripped before saving because they cannot survive reloads.

## Notes

Blob-backed media still needs IndexedDB or file persistence for true reload-safe media recovery. This patch prevents memory leaks and preserves project structure, but uploaded binary files themselves are not persisted across browser refreshes.
