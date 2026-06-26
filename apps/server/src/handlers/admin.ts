import { AdminUserService } from '../services/AdminUserService'
import { CommunityAssetService } from '../services/CommunityAssetService'
import { LibraryService } from '../services/LibraryService'
import { MediaStorageService } from '../services/MediaStorageService'

const adminUserService = new AdminUserService()
const communityAssetService = new CommunityAssetService()
const libraryService = new LibraryService()
const mediaStorage = new MediaStorageService()

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
    publicUrl: mediaStorage.getPublicUrl(asset.fileKey),
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
  }
}

export async function listCommunityAssets(_request: any, reply: any) {
  const assets = await communityAssetService.list()
  return reply.send({ data: assets.map(toCommunityAssetDto) })
}

export async function requestCommunityUploadUrl(request: any, reply: any) {
  const body = request.body as {
    filename: string
    mimeType: string
    sizeBytes: number
    title?: string
  }
  const fileKey = mediaStorage.buildFileKey(request.user.id, body.filename)
  const uploadUrl = await mediaStorage.createUploadUrl(fileKey, body.mimeType, body.sizeBytes)
  return reply.send({ data: { fileKey, uploadUrl } })
}

export async function completeCommunityUpload(request: any, reply: any) {
  const body = request.body as {
    fileKey: string
    filename: string
    mimeType: string
    sizeBytes: number
    title?: string | null
  }

  const existing = await communityAssetService.findByFileKey(body.fileKey)
  if (existing) {
    return reply.status(409).send({ error: 'Asset already registered for this file key' })
  }

  const exists = await mediaStorage.objectExists(body.fileKey)
  if (!exists) {
    return reply.status(400).send({ error: 'Upload not found — complete the file upload first' })
  }

  let sizeBytes = body.sizeBytes
  if (!mediaStorage.isCloudStorage()) {
    sizeBytes = mediaStorage.localSize(body.fileKey)
  }

  const asset = await communityAssetService.create({
    uploadedBy: request.user.id,
    fileKey: body.fileKey,
    filename: body.filename,
    mimeType: body.mimeType,
    sizeBytes,
    title: body.title ?? null,
  })

  return reply.status(201).send({ data: toCommunityAssetDto(asset) })
}

export async function updateCommunityAsset(request: any, reply: any) {
  const { id } = request.params as { id: string }
  const body = request.body as { title?: string | null; published?: boolean }
  const updated = await communityAssetService.update(id, body)
  return reply.send({ data: toCommunityAssetDto(updated) })
}

export async function deleteCommunityAsset(request: any, reply: any) {
  const { id } = request.params as { id: string }
  const asset = await communityAssetService.findById(id)
  if (!asset) {
    return reply.status(404).send({ error: 'Not found' })
  }
  await mediaStorage.deleteObject(asset.fileKey)
  await communityAssetService.delete(id)
  return reply.status(204).send()
}

// ── Library overrides ──────────────────────────────────────────────────────

export async function listLibraryOverrides(_request: any, reply: any) {
  const disabledKeys = await libraryService.listDisabledKeys()
  return reply.send({ data: disabledKeys })
}

export async function setLibraryItemEnabled(request: any, reply: any) {
  const { itemKey } = request.params as { itemKey: string }
  const body = request.body as { enabled: boolean }
  const result = await libraryService.setItemEnabled(decodeURIComponent(itemKey), body.enabled)
  return reply.send({ data: result })
}
