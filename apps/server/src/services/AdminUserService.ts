import { UserRole, db } from '@avl/db'

export class AdminUserService {
  async listUsers() {
    return db.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        role: true,
        suspendedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    })
  }

  async updateUser(
    id: string,
    requestingUserId: string,
    data: { role?: string; suspended?: boolean },
  ) {
    const target = await db.user.findUniqueOrThrow({ where: { id } })

    // Prevent self-modification that could lock out the admin.
    if (id === requestingUserId) {
      if (data.suspended === true) throw { statusCode: 400, message: 'Cannot suspend your own account' }
      if (data.role === UserRole.USER) throw { statusCode: 400, message: 'Cannot demote your own account' }
    }

    // Prevent demoting or suspending the last admin.
    if (target.role === UserRole.ADMIN) {
      const wouldLoseAdmin = data.role === UserRole.USER || data.suspended === true
      if (wouldLoseAdmin) await this.ensureNotLastAdmin(id)
    }

    return db.user.update({
      where: { id },
      data: {
        ...(data.role !== undefined ? { role: data.role as UserRole } : {}),
        ...(data.suspended !== undefined ? { suspendedAt: data.suspended ? new Date() : null } : {}),
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        role: true,
        suspendedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    })
  }

  async deleteUser(id: string, requestingUserId: string) {
    if (id === requestingUserId) {
      throw { statusCode: 400, message: 'Cannot delete your own account' }
    }

    const target = await db.user.findUniqueOrThrow({ where: { id } })

    if (target.role === UserRole.ADMIN) {
      await this.ensureNotLastAdmin(id)
    }

    await db.user.delete({ where: { id } })
  }

  private async ensureNotLastAdmin(userId: string) {
    // Count active admins. A suspended admin still counts — if they're the last
    // admin record, we must not allow demotion/deletion.
    const adminCount = await db.user.count({ where: { role: UserRole.ADMIN } })
    if (adminCount <= 1) {
      throw { statusCode: 400, message: 'Cannot modify the last admin account' }
    }
    void userId
  }
}
