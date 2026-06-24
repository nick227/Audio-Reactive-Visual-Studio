import { AdminUserService } from '../services/AdminUserService'
import { CommunityAssetService } from '../services/CommunityAssetService'

const adminUserService = new AdminUserService()
const communityAssetService = new CommunityAssetService()

// ── User management ────────────────────────────────────────────────────────

function toUserDto(user: {
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

export async function listAdminUsers(_request: any, reply: any) {
  const users = await adminUserService.listUsers()
  return reply.send({ data: users.map(toUserDto) })
}

export async function updateAdminUser(request: any, reply: any) {
  const { id } = request.params as { id: string }
  const body = request.body as { role?: string; suspended?: boolean }
  const updated = await adminUserService.updateUser(id, request.user.id, body)
  return reply.send({ data: toUserDto(updated) })
}

export async function deleteAdminUser(request: any, reply: any) {
  const { id } = request.params as { id: string }
  await adminUserService.deleteUser(id, request.user.id)
  return reply.status(204).send()
}

// ── Community assets ───────────────────────────────────────────────────────

function toCommunityAssetDto(asset: {
  id: string
  fileKey: string
  filename: string
  mimeType: string
  sizeBytes: number
  title: string | null
  published: boolean
  uploadedBy: string
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: asset.id,
    fileKey: asset.fileKey,
    filename: asset.filename,
    mimeType: asset.mimeType,
    sizeBytes: asset.sizeBytes,
    title: asset.title,
    published: asset.published,
    uploadedBy: asset.uploadedBy,
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
  }
}

export async function listCommunityAssets(_request: any, reply: any) {
  const assets = await communityAssetService.list()
  return reply.send({ data: assets.map(toCommunityAssetDto) })
}

export async function requestCommunityUploadUrl(_request: any, reply: any) {
  return reply.status(501).send({ error: 'R2 upload not yet implemented (Phase 2)' })
}

export async function completeCommunityUpload(_request: any, reply: any) {
  return reply.status(501).send({ error: 'R2 upload not yet implemented (Phase 2)' })
}

export async function updateCommunityAsset(request: any, reply: any) {
  const { id } = request.params as { id: string }
  const body = request.body as { title?: string | null; published?: boolean }
  const updated = await communityAssetService.update(id, body)
  return reply.send({ data: toCommunityAssetDto(updated) })
}

export async function deleteCommunityAsset(request: any, reply: any) {
  const { id } = request.params as { id: string }
  await communityAssetService.delete(id)
  return reply.status(204).send()
}
