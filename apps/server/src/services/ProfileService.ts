import { db } from '@avl/db'

export class ProfileService {
  async update(userId: string, data: { displayName?: string; avatarUrl?: string | null }) {
    return db.user.update({
      where: { id: userId },
      data,
    })
  }
}
