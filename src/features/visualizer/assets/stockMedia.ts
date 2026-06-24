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
export const STOCK_VIDEOS: StockMediaRecord[] = []
