// Phase 2 — R2 upload stubs. Implement after R2 credentials are configured.

export async function requestUploadUrl(_request: any, reply: any) {
  return reply.status(501).send({ error: 'R2 uploads not yet configured (Phase 2)' })
}

export async function completeUpload(_request: any, reply: any) {
  return reply.status(501).send({ error: 'R2 uploads not yet configured (Phase 2)' })
}
