# Stock media for Add Layer

Drop files here to make them available in the **Images** and **Videos** filter chips.

## Folders

| Folder | Formats | Served at |
|--------|---------|-----------|
| `public/stock/images/` | `.jpg`, `.jpeg`, `.png`, `.webp`, `.svg`, `.gif` | `/stock/images/your-file.jpg` |
| `public/stock/videos/` | `.mp4`, `.webm`, `.mov` | `/stock/videos/your-file.mp4` |

Vite copies everything under `public/` to the site root, so no import or rebuild config is needed beyond registering the file.

## Register new stock files

After adding a file, append an entry in:

`src/features/visualizer/assets/stockMedia.ts`

```ts
{ id: 'stock-my-photo', name: 'My Photo', url: '/stock/images/my-photo.jpg', fileKey: 'stock:my-photo' },
```

Use a unique `id`, a display `name`, the public `url` path, and a `fileKey` prefixed with `stock:`.

## Notes

- Keep filenames lowercase with hyphens (e.g. `city-night-loop.mp4`).
- Large videos increase repo and load size — prefer short loops under ~10 MB when possible.
- User **Upload** in the modal still adds session-only media; stock files are bundled with the app.
