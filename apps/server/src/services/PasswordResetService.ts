import { createHash, randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'
import { db } from '@avl/db'

const RESET_TTL_MS = 60 * 60 * 1000 // 1 hour
const BCRYPT_ROUNDS = 12

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

export class PasswordResetService {
  async requestReset(email: string): Promise<{ rawToken: string; userEmail: string } | null> {
    const user = await db.user.findUnique({ where: { email } })
    // Return null silently — callers must not reveal whether the email exists.
    if (!user) return null

    // Invalidate any prior pending tokens for this user before issuing a new one.
    await db.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    })

    const rawToken = randomBytes(32).toString('hex')

    await db.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: sha256(rawToken),
        expiresAt: new Date(Date.now() + RESET_TTL_MS),
      },
    })

    return { rawToken, userEmail: user.email }
  }

  async confirmReset(rawToken: string, newPassword: string): Promise<void> {
    const tokenHash = sha256(rawToken)
    const record = await db.passwordResetToken.findUnique({ where: { tokenHash } })

    if (!record || record.usedAt) {
      throw { statusCode: 400, message: 'Invalid or already-used reset token' }
    }
    if (record.expiresAt < new Date()) {
      throw { statusCode: 400, message: 'Reset token has expired' }
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS)

    await db.$transaction([
      db.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
      db.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ])
  }
}
