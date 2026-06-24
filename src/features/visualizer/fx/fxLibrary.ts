import { communityAssets } from '../assets/registry'
import type { AssetCategory, AssetCollection, AssetTemplate } from '../project/types'

export type FxItem = {
  id: string
  title: string
  category?: AssetCategory
  collection?: AssetCollection
  tags: string[]
  settings: Record<string, unknown>
  add: { mode: 'layer'; templateId: string }
}

export type CommunitySection = {
  collection: AssetCollection
  label: string
}

export const COMMUNITY_SECTIONS: CommunitySection[] = [
  { collection: 'backgrounds', label: 'Backgrounds' },
  { collection: 'visualizers', label: 'Visualizers' },
  { collection: 'particles', label: 'Particles' },
  { collection: 'objects', label: 'Objects' },
  { collection: 'type-frames', label: 'Type & Frames' },
  { collection: 'fx-overlays', label: 'FX' },
  { collection: 'puppets', label: 'Puppets' },
]

export const fxItems: FxItem[] = communityAssets
  .filter((asset) => asset.collection !== 'uploads')
  .map(assetToFxItem)

export const textItems: FxItem[] = communityAssets
  .filter((asset) => asset.category === 'typography')
  .map(assetToFxItem)

export const puppetItems: FxItem[] = communityAssets
  .filter((asset) => asset.category === 'puppets')
  .map(assetToFxItem)

export type LayerTypeFilter =
  | 'all'
  | 'images'
  | 'videos'
  | 'text'
  | 'backdrop'
  | 'particles'
  | 'objects'
  | 'type-frames'
  | 'fx-overlays'

export const LAYER_TYPE_FILTERS: { id: LayerTypeFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'images', label: 'Images' },
  { id: 'videos', label: 'Videos' },
  { id: 'text', label: 'Text' },
  { id: 'backdrop', label: 'Backdrops' },
  { id: 'particles', label: 'Particles' },
  { id: 'objects', label: 'Objects' },
  { id: 'type-frames', label: 'Type & Frames' },
  { id: 'fx-overlays', label: 'FX' },
]

export function filterByLayerType(items: FxItem[], filter: LayerTypeFilter): FxItem[] {
  if (filter === 'all' || filter === 'images' || filter === 'videos') return []
  if (filter === 'text') return items.filter((item) => item.category === 'typography')
  if (filter === 'backdrop') {
    return items.filter((item) => item.collection === 'backgrounds' || item.collection === 'visualizers')
  }
  if (filter === 'objects') {
    return items.filter((item) => item.collection === 'objects' || item.collection === 'puppets')
  }
  return items.filter((item) => item.collection === filter)
}

export function filterFxItems(items: FxItem[], query: string): FxItem[] {
  if (!query.trim()) return items
  const q = query.trim().toLowerCase()
  return items.filter((item) =>
    [item.title, item.category, item.collection, ...item.tags]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(q),
  )
}

export function filterCommunityItems(query: string): FxItem[] {
  return filterFxItems(fxItems, query)
}

export function getLayerCatalogItems(query: string): FxItem[] {
  const all = filterCommunityItems(query)
  const text = all.filter((i) => i.category === 'typography')
  const puppets = all.filter((i) => i.category === 'puppets')
  const library = COMMUNITY_SECTIONS
    .filter((s) => s.collection !== 'puppets')
    .flatMap((section) =>
      all.filter((item) => {
        if (item.collection !== section.collection) return false
        if (section.collection === 'type-frames' && item.category === 'typography') return false
        return true
      }),
    )
  return [...text, ...puppets, ...library]
}

export function getLibrarySections(items: FxItem[]): Array<{ section: CommunitySection; items: FxItem[] }> {
  return COMMUNITY_SECTIONS
    .filter((section) => section.collection !== 'puppets')
    .map((section) => ({
      section,
      items: items.filter((item) => {
        if (item.collection !== section.collection) return false
        if (section.collection === 'type-frames' && item.category === 'typography') return false
        return true
      }),
    }))
    .filter((group) => group.items.length > 0)
}

export function getItemsBySection(items: FxItem[]): Array<{ section: CommunitySection; items: FxItem[] }> {
  return COMMUNITY_SECTIONS.map((section) => ({
    section,
    items: items.filter((item) => item.collection === section.collection),
  })).filter((group) => group.items.length > 0)
}

function assetToFxItem(asset: AssetTemplate): FxItem {
  const collection = asset.collection ?? 'backgrounds'
  return {
    id: `asset:${asset.id}`,
    title: asset.name,
    category: asset.category,
    collection,
    tags: [...(asset.tags ?? []), asset.category ?? '', collection],
    settings: asset.defaultLayer.settings ?? {},
    add: { mode: 'layer', templateId: asset.id },
  }
}
