import { createReadStream, createWriteStream, existsSync, mkdirSync, statSync, unlinkSync } from 'fs'
import { dirname, join } from 'path'
import { randomBytes } from 'crypto'
import { S3Client, PutObjectCommand, HeadObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const UPLOAD_ROOT = join(process.cwd(), 'uploads', 'community')

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

export class MediaStorageService {
  isCloudStorage() {
    return r2Configured()
  }

  buildFileKey(userId: string, filename: string) {
    const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
    return `community/${userId}/${randomBytes(8).toString('hex')}-${safe}`
  }

  getPublicUrl(fileKey: string) {
    if (r2Configured() && process.env.R2_PUBLIC_BASE_URL) {
      return `${process.env.R2_PUBLIC_BASE_URL.replace(/\/$/, '')}/${fileKey}`
    }
    const base = process.env.APP_URL ?? `http://localhost:${process.env.PORT ?? 3001}`
    return `${base.replace(/\/$/, '')}/media/community/${encodeURIComponent(fileKey)}`
  }

  async createUploadUrl(fileKey: string, mimeType: string, sizeBytes: number) {
    if (r2Configured()) {
      const command = new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: fileKey,
        ContentType: mimeType,
        ContentLength: sizeBytes,
      })
      const uploadUrl = await getSignedUrl(s3Client(), command, { expiresIn: 3600 })
      return uploadUrl
    }

    const base = process.env.APP_URL ?? `http://localhost:${process.env.PORT ?? 3001}`
    return `${base.replace(/\/$/, '')}/internal/community-upload/${encodeURIComponent(fileKey)}`
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

  localSize(fileKey: string) {
    return statSync(this.localPath(fileKey)).size
  }
}
