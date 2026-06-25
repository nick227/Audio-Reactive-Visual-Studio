import bcrypt from 'bcryptjs'
import { db } from '@avl/db'
import { randomUUID } from 'crypto'

const BCRYPT_ROUNDS = 12
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000

export class PasswordAuthService {
  async register(email: string, password: string, displayName: string) {
    const existing = await db.user.findUnique({ where: { email } })
    if (existing) throw { statusCode: 409, message: 'Email already in use' }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)
    const user = await db.user.create({
      data: { email, displayName, passwordHash },
    })

    db.session.deleteMany({
      where: { userId: user.id, expiresAt: { lt: new Date() } },
    }).catch(() => {})

    const session = await db.session.create({
      data: {
        userId: user.id,
        token: randomUUID(),
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      },
    })

    return { user, token: session.token }
  }

  async login(email: string, password: string) {
    const user = await db.user.findUnique({ where: { email } })
    if (!user || !user.passwordHash) {
      throw { statusCode: 401, message: 'Invalid email or password' }
    }
    if (user.suspendedAt) {
      throw { statusCode: 403, message: 'Account suspended' }
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) throw { statusCode: 401, message: 'Invalid email or password' }

    db.session.deleteMany({
      where: { userId: user.id, expiresAt: { lt: new Date() } },
    }).catch(() => {})

    const session = await db.session.create({
      data: {
        userId: user.id,
        token: randomUUID(),
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      },
    })

    return { user, token: session.token }
  }
}
