# Local Project Library — Manual Smoke Test

Top bar status copy: **Saved locally**

## Checklist

1. Open legacy single-project browser state (`audio-visual-layer.project.v1` in localStorage).
2. Confirm migration creates index (`audio-visual-layer.index.v1`) + active project id.
3. Confirm audio/image/video rehydrate after reload.
4. Rename project; reload; confirm title persists in top bar and project menu.
5. Create new project; confirm blank stage, no layers, no audio.
6. Switch back; confirm old media returns.
7. Rapidly switch projects several times; confirm no wrong media appears.
8. Duplicate a project with media; confirm copy opens with same layers/audio and title `{name} Copy`.
9. Delete a duplicate; confirm original project media still works (shared blob keys preserved).
10. Delete the only remaining project; confirm a new empty project opens.
11. Sign in; rename; confirm edits continue even if title sync fails (offline / blocked API).
12. Export WebM from old and new project.

## Delete / duplicate UI

- Project menu: each row has **Duplicate** (copy icon) and **Delete** (trash icon).
- Delete shows a confirm dialog before removing the project.
- Deleting the active project switches to the next most recently updated project.
