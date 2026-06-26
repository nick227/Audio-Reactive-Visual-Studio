import { db } from '@avl/db'
import { CommunityAssetService } from './CommunityAssetService'
import { MediaStorageService } from './MediaStorageService'
import type { FastifyBaseLogger, FastifyRequest } from 'fastify'

const communityAssets = new CommunityAssetService()
const mediaStorage = new MediaStorageService()

export class LibraryService {
  async listDisabledKeys() {
    const rows = await db.disabledLibraryItem.findMany({ select: { itemKey: true } })
    return rows.map((r) => r.itemKey)
  }

  async setItemEnabled(itemKey: string, enabled: boolean) {
    if (enabled) {
      await db.disabledLibraryItem.deleteMany({ where: { itemKey } })
      return { itemKey, enabled: true }
    }
    await db.disabledLibraryItem.upsert({
      where: { itemKey },
      create: { itemKey },
      update: {},
    })
    return { itemKey, enabled: false }
  }

  async getPublicConfig(request?: FastifyRequest, logger?: FastifyBaseLogger) {
    let disabledKeys: string[] = []
    try {
      disabledKeys = await this.listDisabledKeys()
    } catch (error) {
      logger?.warn({ error }, 'Failed to load disabled library item keys; continuing with all seed items enabled')
      // Public library loading should not fail just because seed-item overrides
      // have not been pushed to a production database yet.
      disabledKeys = []
    }
    const assets = await communityAssets.listPublished()
    const cloudAssets = assets.map((asset) => ({
      id: asset.id,
      title: asset.title ?? asset.filename,
      filename: asset.filename,
      mimeType: asset.mimeType,
      publicUrl: mediaStorage.getPublicUrl(asset.fileKey, request),
      kind: asset.mimeType.startsWith('video/')
        ? 'video' as const
        : asset.mimeType.startsWith('audio/')
          ? 'audio' as const
          : 'image' as const,
    }))
    return { disabledKeys, cloudAssets }
  }
}
