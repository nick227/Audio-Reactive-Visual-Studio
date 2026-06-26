import { db } from '@avl/db'
import { CommunityAssetService } from './CommunityAssetService'
import { MediaStorageService } from './MediaStorageService'

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

  async getPublicConfig() {
    const disabledKeys = await this.listDisabledKeys()
    const assets = await communityAssets.listPublished()
    const cloudAssets = assets.map((asset) => ({
      id: asset.id,
      title: asset.title ?? asset.filename,
      filename: asset.filename,
      mimeType: asset.mimeType,
      publicUrl: mediaStorage.getPublicUrl(asset.fileKey),
      kind: asset.mimeType.startsWith('video/')
        ? 'video' as const
        : asset.mimeType.startsWith('audio/')
          ? 'audio' as const
          : 'image' as const,
    }))
    return { disabledKeys, cloudAssets }
  }
}
