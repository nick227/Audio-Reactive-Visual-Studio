import { GoogleAuthService } from '../services/GoogleAuthService'
import { PasswordResetService } from '../services/PasswordResetService'
import { EmailService } from '../services/EmailService'

const googleAuthService = new GoogleAuthService()
const passwordResetService = new PasswordResetService()
const emailService = new EmailService()

const COOKIE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: (process.env.NODE_ENV === 'production' ? 'none' : 'lax') as 'none' | 'lax',
  path: '/',
  maxAge: 30 * 24 * 60 * 60,
}

export async function googleAuth(request: any, reply: any) {
  const { user, token } = await googleAuthService.authenticate(request.body.credential)
  reply.setCookie('token', token, COOKIE)
  return reply.send({ data: toUserDto(user) })
}

export async function getCurrentUser(request: any, reply: any) {
  return reply.send({ data: toUserDto(request.user) })
}

export async function logout(request: any, reply: any) {
  const token = request.cookies?.token ?? request.headers.authorization?.replace('Bearer ', '')
  if (token) {
    const { db } = await import('@avl/db')
    await db.session.deleteMany({ where: { token } })
  }
  // Flags must match the Set-Cookie that created the cookie or some browsers ignore the clear
  reply.clearCookie('token', { path: '/', httpOnly: COOKIE.httpOnly, secure: COOKIE.secure, sameSite: COOKIE.sameSite })
  return reply.send({ data: null })
}

export async function requestPasswordReset(request: any, reply: any) {
  const { email } = request.body as { email: string }
  const result = await passwordResetService.requestReset(email)

  if (result) {
    const appUrl = process.env.APP_URL ?? 'http://localhost:5173'
    const resetUrl = `${appUrl}/reset-password?token=${result.rawToken}`
    await emailService.sendPasswordResetEmail(result.userEmail, resetUrl)
  }

  // Always 200 — never reveal whether the email exists in the system.
  return reply.send({ data: null })
}

export async function confirmPasswordReset(request: any, reply: any) {
  const { token, newPassword } = request.body as { token: string; newPassword: string }
  await passwordResetService.confirmReset(token, newPassword)
  return reply.send({ data: null })
}

function toUserDto(user: { id: string; email: string; displayName: string; avatarUrl: string | null; role: string; suspendedAt: Date | null; createdAt: Date; updatedAt: Date }) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    role: user.role,
    suspendedAt: user.suspendedAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  }
}
