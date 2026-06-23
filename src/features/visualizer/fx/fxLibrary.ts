import { communityAssets } from '../assets/registry'
import type { AssetCategory, AssetCollection, AssetTemplate } from '../project/types'

export type FxTabId = 'mine' | 'text' | 'puppets' | 'community'

export type FxItem = {
  id: string
  title: string
  category?: AssetCategory
  collection?: AssetCollection
  tags: string[]
  settings: Record<string, unknown>
  add: { mode: 'layer'; templateId: string }
}

export type FxTab = {
  id: FxTabId
  label: string
}

export const fxTabs: FxTab[] = [
  { id: 'mine', label: 'Mine' },
  { id: 'text', label: 'Text' },
  { id: 'puppets', label: 'Puppets' },
  { id: 'community', label: 'Community' },
]

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

export function filterCommunityItems(query: string): FxItem[] {
  if (!query.trim()) return fxItems
  const q = query.trim().toLowerCase()
  return fxItems.filter((item) =>
    [item.title, item.category, item.collection, ...item.tags]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(q)
  )
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
