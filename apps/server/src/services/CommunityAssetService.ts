import { db } from '@avl/db'

export class CommunityAssetService {
  async list() {
    return db.communityAsset.findMany({ orderBy: { createdAt: 'desc' } })
  }

  async update(id: string, data: { title?: string | null; published?: boolean }) {
    return db.communityAsset.update({ where: { id }, data })
  }

  async delete(id: string) {
    // Note: this only removes the DB record. The R2 object must be cleaned up
    // separately once the R2 delete flow is wired in Phase 2.
    await db.communityAsset.delete({ where: { id } })
  }
}
