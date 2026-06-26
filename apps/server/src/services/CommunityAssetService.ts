import { db } from '@avl/db'

export class CommunityAssetService {
  async list() {
    return db.communityAsset.findMany({ orderBy: { createdAt: 'desc' } })
  }

  async listPublished() {
    return db.communityAsset.findMany({
      where: { published: true },
      orderBy: { createdAt: 'desc' },
    })
  }

  async findById(id: string) {
    return db.communityAsset.findUnique({ where: { id } })
  }

  async findByFileKey(fileKey: string) {
    return db.communityAsset.findUnique({ where: { fileKey } })
  }

  async create(data: {
    uploadedBy: string
    fileKey: string
    filename: string
    mimeType: string
    sizeBytes: number
    title?: string | null
  }) {
    return db.communityAsset.create({
      data: { ...data, published: false },
    })
  }

  async update(id: string, data: { title?: string | null; published?: boolean }) {
    return db.communityAsset.update({ where: { id }, data })
  }

  async delete(id: string) {
    await db.communityAsset.delete({ where: { id } })
  }
}
