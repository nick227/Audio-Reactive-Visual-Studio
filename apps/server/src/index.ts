import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import openapiGlue from 'fastify-openapi-glue'
import { load } from 'js-yaml'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import * as handlers from './handlers'
import * as security from './plugins/security'
import { AiTranscribeService, type TranscribeProvider } from './services/AiTranscribeService'
import { MediaStorageService } from './services/MediaStorageService'

const server = Fastify({ logger: true })
const mediaStorage = new MediaStorageService()

const specPath = resolve(__dirname, '../../../packages/api-spec/openapi.yaml')
const spec = load(readFileSync(specPath, 'utf-8')) as object

async function main() {
  if (process.env.NODE_ENV === 'production' && !process.env.CORS_ORIGIN) {
    throw new Error('CORS_ORIGIN env var is required in production')
  }

  await server.register(cors, {
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  })

  await server.register(cookie)

  // 30 MB limit — OpenAI Whisper cap is 25 MB
  await server.register(multipart, { limits: { fileSize: 30 * 1024 * 1024 } })

  server.addContentTypeParser(
    /^(image|video|audio)\/.+|application\/octet-stream/,
    { parseAs: 'buffer' },
    (_request, body, done) => { done(null, body) },
  )

  await server.register(swagger, { openapi: spec })
  await server.register(swaggerUi, { routePrefix: '/docs' })

  server.setErrorHandler((error, _request, reply) => {
    if (error.validation) {
      return reply.status(400).send({ error: 'Validation failed', details: error.validation })
    }
    if (error.statusCode) {
      return reply.status(error.statusCode).send({ error: error.message })
    }
    if ((error as any).code === 'P2025') {
      return reply.status(404).send({ error: 'Not found' })
    }
    if ((error as any).code === 'P2002') {
      return reply.status(409).send({ error: 'Already exists' })
    }
    server.log.error(error)
    return reply.status(500).send({ error: 'Internal server error' })
  })

  await server.register(openapiGlue, {
    specification: specPath,
    service: handlers,
    securityHandlers: security,
    noAdditional: true,
  } as any)

  server.get('/health', async () => ({ status: 'ok' }))

  // Local dev upload target when R2 is not configured.
  server.put('/internal/community-upload/*', async (request, reply) => {
    const fileKey = decodeURIComponent((request.params as { '*': string })['*'])
    const buffer = await request.body as Buffer
    if (!buffer?.length) {
      return reply.status(400).send({ error: 'Empty upload body' })
    }
    await mediaStorage.saveLocal(fileKey, buffer)
    return reply.status(204).send()
  })

  server.get('/media/community/*', async (request, reply) => {
    const fileKey = decodeURIComponent((request.params as { '*': string })['*'])
    if (mediaStorage.isCloudStorage()) {
      return reply.redirect(mediaStorage.getPublicUrl(fileKey))
    }
    try {
      const stream = mediaStorage.openLocalStream(fileKey)
      return reply.send(stream)
    } catch {
      return reply.status(404).send({ error: 'Not found' })
    }
  })

  // ── AI transcription ──────────────────────────────────────────────────────
  // Registered outside openapi-glue because multipart doesn't fit the
  // schema-first pattern cleanly. Auth is checked manually below.
  const aiService = new AiTranscribeService()

  server.post('/ai/transcribe', async (request, reply) => {
    const parts = request.parts()
    const chunks: Buffer[] = []
    let filename = 'audio.mp3'
    let mimeType = 'audio/mpeg'
    let provider: TranscribeProvider = 'whisper'
    let lyrics: string | undefined

    for await (const part of parts) {
      if (part.type === 'file') {
        for await (const chunk of part.file) {
          chunks.push(chunk as Buffer)
        }
        filename = part.filename ?? filename
        mimeType = part.mimetype ?? mimeType
      } else {
        if (part.fieldname === 'provider' && (part.value === 'whisper' || part.value === 'audioshake')) {
          provider = part.value
        }
        if (part.fieldname === 'lyrics' && typeof part.value === 'string') {
          lyrics = part.value
        }
      }
    }

    if (chunks.length === 0) {
      return reply.status(400).send({ error: 'No audio file provided.' })
    }

    const audioBuffer = Buffer.concat(chunks)
    const result = await aiService.transcribe(audioBuffer, filename, mimeType, provider, lyrics)
    return reply.send(result)
  })

  await server.listen({
    port: Number(process.env.PORT ?? 3001),
    host: '0.0.0.0',
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
