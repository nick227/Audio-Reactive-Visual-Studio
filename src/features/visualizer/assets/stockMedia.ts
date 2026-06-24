export type StockMediaRecord = {
  id: string
  name: string
  /** Public URL — files live under /public/stock/ */
  url: string
  fileKey: string
}

/** Bundled stock images — add files to public/stock/images/ and list them here. */
export const STOCK_IMAGES: StockMediaRecord[] = [
  { id: 'stock-nebula', name: 'Nebula Gradient', url: '/stock/images/nebula.svg', fileKey: 'stock:nebula' },
  { id: 'stock-mesh', name: 'Mesh Glow', url: '/stock/images/mesh.svg', fileKey: 'stock:mesh' },
  { id: 'stock-grain-dark', name: 'Dark Grain', url: '/stock/images/grain-dark.svg', fileKey: 'stock:grain-dark' },
  { id: 'stock-split-tone', name: 'Split Tone', url: '/stock/images/split-tone.svg', fileKey: 'stock:split-tone' },
]

/** Bundled stock videos — add files to public/stock/videos/ and list them here. */
export const STOCK_VIDEOS: StockMediaRecord[] = [
  { id: 'stock-dance', name: 'Dance Girls', url: '/stock/videos/dancing.mp4', fileKey: 'stock:dance' },
  { id: 'stock-walk', name: 'Nice Walk', url: '/stock/videos/walk.mp4', fileKey: 'stock:walk' },
  { id: 'stock-dj', name: 'lady dj', url: '/stock/videos/dj-women.mp4', fileKey: 'stock:dj' },
  { id: 'stock-watches', name: 'Nice watches', url: '/stock/videos/watches.mp4', fileKey: 'stock:watches' },
  { id: 'stock-face', name: 'Nice face', url: '/stock/videos/face.mp4', fileKey: 'stock:face' },
  { id: 'stock-streets', name: 'Nice streets', url: '/stock/videos/streets.mp4', fileKey: 'stock:streets' },
  { id: 'stock-art', name: 'Nice art', url: '/stock/videos/art.mp4', fileKey: 'stock:art' },
  { id: 'stock-djman', name: 'Nice Walk', url: '/stock/videos/dj-man.mp4', fileKey: 'stock:djman' },
]
