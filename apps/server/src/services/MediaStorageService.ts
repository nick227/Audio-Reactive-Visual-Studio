import { createReadStream, createWriteStream, existsSync, mkdirSync, statSync, unlinkSync } from 'fs'
import { dirname, join } from 'path'
import { randomBytes } from 'crypto'
import { S3Client, PutObjectCommand, HeadObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import type { FastifyRequest } from 'fastify'

const UPLOAD_ROOT = join(process.cwd(), 'uploads', 'community')
const MAX_COMMUNITY_FILE_KEY_LENGTH = 191
const FALLBACK_FILENAME = 'upload'

function headerValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function serverBase(request?: FastifyRequest) {
  if (process.env.API_PUBLIC_URL) {
    return process.env.API_PUBLIC_URL.replace(/\/$/, '')
  }

  if (request) {
    const forwardedProto = headerValue(request.headers['x-forwarded-proto'])
    const forwardedHost = headerValue(request.headers['x-forwarded-host'])
    const proto = forwardedProto?.split(',')[0]?.trim() || request.protocol || 'http'
    const host = forwardedHost?.split(',')[0]?.trim() || request.headers.host
    if (host) {
      return `${proto}://${host}`
    }
  }

  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  }

  return `http://localhost:${process.env.PORT ?? 3001}`
}

function r2Configured() {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME,
  )
}

function s3Client() {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  })
}

function contentTypeFromKey(fileKey: string) {
  const ext = fileKey.split('.').pop()?.toLowerCase()
  if (ext === 'png') return 'image/png'
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'gif') return 'image/gif'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'svg') return 'image/svg+xml'
  if (ext === 'mp4') return 'video/mp4'
  if (ext === 'webm') return 'video/webm'
  if (ext === 'mp3') return 'audio/mpeg'
  if (ext === 'wav') return 'audio/wav'
  return 'application/octet-stream'
}

function truncateFilename(filename: string, maxLength: number) {
  if (maxLength <= 0) return ''
  if (filename.length <= maxLength) return filename

  const dotIndex = filename.lastIndexOf('.')
  const hasExtension = dotIndex > 0 && dotIndex < filename.length - 1
  const extension = hasExtension ? filename.slice(dotIndex) : ''
  if (extension.length >= maxLength) {
    return filename.slice(0, maxLength)
  }

  return `${filename.slice(0, maxLength - extension.length)}${extension}`
}

export class MediaStorageService {
  isCloudStorage() {
    return r2Configured()
  }

  buildFileKey(userId: string, filename: string) {
    const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_') || FALLBACK_FILENAME
    const prefix = `community/${userId}/${randomBytes(8).toString('hex')}-`
    const maxFilenameLength = MAX_COMMUNITY_FILE_KEY_LENGTH - prefix.length
    return `${prefix}${truncateFilename(safe, maxFilenameLength)}`
  }

  /** API-proxied URL — required for COEP pages (Vite sets require-corp). */
  getPublicUrl(fileKey: string, request?: FastifyRequest) {
    const encoded = fileKey.split('/').map(encodeURIComponent).join('/')
    return `${serverBase(request)}/media/community/${encoded}`
  }

  createUploadUrl(fileKey: string, request?: FastifyRequest) {
    return `${serverBase(request)}/internal/community-upload/${encodeURIComponent(fileKey)}`
  }

  async putObject(fileKey: string, body: Buffer, mimeType: string) {
    if (r2Configured()) {
      await s3Client().send(new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: fileKey,
        Body: body,
        ContentType: mimeType,
      }))
      return
    }
    await this.saveLocal(fileKey, body)
  }

  async saveLocal(fileKey: string, buffer: Buffer) {
    const dest = join(UPLOAD_ROOT, fileKey)
    mkdirSync(dirname(dest), { recursive: true })
    await new Promise<void>((resolve, reject) => {
      const stream = createWriteStream(dest)
      stream.on('error', reject)
      stream.on('finish', resolve)
      stream.end(buffer)
    })
  }

  localPath(fileKey: string) {
    return join(UPLOAD_ROOT, fileKey)
  }

  async objectExists(fileKey: string) {
    if (r2Configured()) {
      try {
        await s3Client().send(new HeadObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME!,
          Key: fileKey,
        }))
        return true
      } catch {
        return false
      }
    }
    return existsSync(this.localPath(fileKey))
  }

  async deleteObject(fileKey: string) {
    if (r2Configured()) {
      await s3Client().send(new DeleteObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: fileKey,
      }))
      return
    }
    const path = this.localPath(fileKey)
    if (existsSync(path)) {
      unlinkSync(path)
    }
  }

  openLocalStream(fileKey: string) {
    return createReadStream(this.localPath(fileKey))
  }

  async openObject(fileKey: string): Promise<{ stream: NodeJS.ReadableStream; contentType: string }> {
    if (r2Configured()) {
      const result = await s3Client().send(new GetObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: fileKey,
      }))
      if (!result.Body) throw new Error('Empty object body')
      return {
        stream: result.Body as NodeJS.ReadableStream,
        contentType: result.ContentType ?? contentTypeFromKey(fileKey),
      }
    }
    return {
      stream: this.openLocalStream(fileKey),
      contentType: contentTypeFromKey(fileKey),
    }
  }

  localSize(fileKey: string) {
    return statSync(this.localPath(fileKey)).size
  }
}
