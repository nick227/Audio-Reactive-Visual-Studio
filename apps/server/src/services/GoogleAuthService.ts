import { OAuth2Client } from 'google-auth-library'
import { db } from '@avl/db'
import { randomUUID } from 'crypto'

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000

export class GoogleAuthService {
  async authenticate(credential: string) {
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    })

    const payload = ticket.getPayload()
    if (!payload?.sub || !payload.email || !payload.email_verified) {
      throw { statusCode: 400, message: 'Invalid Google credential' }
    }

    const googleId = payload.sub
    const email = payload.email!
    const name = payload.name
    const picture = payload.picture

    let user = await db.user.findFirst({
      where: { OR: [{ googleId }, { email }] },
    })

    if (user) {
      if (user.suspendedAt) {
        throw { statusCode: 403, message: 'Account suspended' }
      }
      if (!user.googleId) {
        user = await db.user.update({
          where: { id: user.id },
          data: { googleId },
        })
      }
    } else {
      user = await db.user.create({
        data: {
          googleId,
          email,
          displayName: name ?? (email.split('@')[0] ?? email),
          avatarUrl: picture ?? null,
        },
      })
    }

    // Prune expired sessions for this user to prevent unbounded accumulation.
    // Fire-and-forget — a failure here should not block the login response.
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
