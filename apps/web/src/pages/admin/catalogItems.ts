import { communityAssets } from '../../features/visualizer/assets/registry'
import { STOCK_IMAGES, STOCK_VIDEOS } from '../../features/visualizer/assets/stockMedia'
import { seedFxItemKey, seedMediaItemKey } from '@avl/sdk'
import { mimeCategory } from './assetUtils'
import type { CommunityAsset } from './types'

export type MediaTab = 'image' | 'video' | 'fx'

export type SeedImageItem = {
  source: 'seed'
  kind: 'image'
  id: string
  name: string
  previewUrl: string
  itemKey: string
}

export type SeedVideoItem = {
  source: 'seed'
  kind: 'video'
  id: string
  name: string
  previewUrl: string
  itemKey: string
}

export type SeedFxItem = {
  source: 'seed'
  kind: 'fx'
  id: string
  name: string
  category: string
  itemKey: string
}

export type CloudItem = {
  source: 'cloud'
  asset: CommunityAsset
}

export type CatalogItem = SeedImageItem | SeedVideoItem | SeedFxItem | CloudItem

export function buildCatalog(tab: MediaTab, cloudAssets: CommunityAsset[]): CatalogItem[] {
  const cloud = cloudAssets
    .filter((a) => {
      if (tab === 'fx') return false
      const cat = mimeCategory(a.mimeType)
      return tab === 'image' ? cat === 'image' : cat === 'video'
    })
    .map((asset): CloudItem => ({ source: 'cloud', asset }))

  if (tab === 'image') {
    const seed = STOCK_IMAGES.map((item): SeedImageItem => ({
      source: 'seed',
      kind: 'image',
      id: item.id,
      name: item.name,
      previewUrl: item.url,
      itemKey: seedMediaItemKey(item.id),
    }))
    return [...seed, ...cloud]
  }

  if (tab === 'video') {
    const seed = STOCK_VIDEOS.map((item): SeedVideoItem => ({
      source: 'seed',
      kind: 'video',
      id: item.id,
      name: item.name,
      previewUrl: item.url,
      itemKey: seedMediaItemKey(item.id),
    }))
    return [...seed, ...cloud]
  }

  const seedFx = communityAssets
    .filter((a) => a.collection !== 'uploads')
    .map((a): SeedFxItem => ({
      source: 'seed',
      kind: 'fx',
      id: a.id,
      name: a.name,
      category: a.category,
      itemKey: seedFxItemKey(a.id),
    }))
  return seedFx
}

export function filterCatalog(items: CatalogItem[], query: string): CatalogItem[] {
  const q = query.trim().toLowerCase()
  if (!q) return items
  return items.filter((item) => {
    if (item.source === 'cloud') {
      const a = item.asset
      return `${a.title ?? ''} ${a.filename}`.toLowerCase().includes(q)
    }
    if (item.kind === 'fx') {
      return [item.name, item.category].join(' ').toLowerCase().includes(q)
    }
    return item.name.toLowerCase().includes(q)
  })
}
