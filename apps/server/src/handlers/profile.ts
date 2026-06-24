import { ProfileService } from '../services/ProfileService'

const profileService = new ProfileService()

function toProfileDto(user: {
  id: string
  email: string
  displayName: string
  avatarUrl: string | null
  role: string
  suspendedAt: Date | null
  createdAt: Date
  updatedAt: Date
}) {
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

export async function getProfile(request: any, reply: any) {
  return reply.send({ data: toProfileDto(request.user) })
}

export async function updateProfile(request: any, reply: any) {
  const body = request.body as { displayName?: string; avatarUrl?: string | null }
  const updated = await profileService.update(request.user.id, body)
  return reply.send({ data: toProfileDto(updated) })
}
