import { db } from '@avl/db'

async function resolveSession(request: any) {
  const token =
    request.cookies?.token ??
    request.headers.authorization?.replace('Bearer ', '')

  if (!token) throw { statusCode: 401, message: 'Unauthorized' }

  const session = await db.session.findUnique({
    where: { token },
    include: { user: true },
  })

  if (!session || session.expiresAt < new Date()) {
    throw { statusCode: 401, message: 'Session expired' }
  }

  if (session.user.suspendedAt) {
    throw { statusCode: 403, message: 'Account suspended' }
  }

  request.user = session.user
}

export async function bearerAuth(request: any, _reply: any, _params: any) {
  await resolveSession(request)
}

export async function adminAuth(request: any, _reply: any, _params: any) {
  await resolveSession(request)
  if (request.user.role !== 'ADMIN') {
    throw { statusCode: 403, message: 'Forbidden: admin only' }
  }
}
