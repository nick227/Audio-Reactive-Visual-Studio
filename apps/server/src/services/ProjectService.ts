import { db } from '@avl/db'

export class ProjectService {
  async list(userId: string) {
    const projects = await db.project.findMany({
      where: { userId },
      include: { share: true },
      orderBy: { updatedAt: 'desc' },
    })
    return projects.map(toSummary)
  }

  async get(id: string, userId: string) {
    const project = await db.project.findFirst({
      where: { id, userId },
      include: { share: true },
    })
    if (!project) throw { statusCode: 404, message: 'Not found' }
    return toFull(project)
  }

  async create(userId: string, input: { title: string; documentJson: unknown; schemaVersion?: number; thumbnailUrl?: string }) {
    const project = await db.project.create({
      data: {
        userId,
        title: input.title,
        documentJson: input.documentJson as any,
        schemaVersion: input.schemaVersion ?? 1,
        thumbnailUrl: input.thumbnailUrl ?? null,
      },
      include: { share: true },
    })
    return toFull(project)
  }

  async update(id: string, userId: string, input: { title?: string; documentJson?: unknown; thumbnailUrl?: string }) {
    try {
      const project = await db.project.update({
        where: { id, userId },
        data: {
          ...(input.title !== undefined && { title: input.title }),
          ...(input.documentJson !== undefined && { documentJson: input.documentJson as any }),
          ...(input.thumbnailUrl !== undefined && { thumbnailUrl: input.thumbnailUrl }),
        },
        include: { share: true },
      })
      return toFull(project)
    } catch (e: any) {
      if (e.code === 'P2025') throw { statusCode: 404, message: 'Not found' }
      throw e
    }
  }

  async delete(id: string, userId: string) {
    try {
      await db.project.delete({ where: { id, userId } })
    } catch (e: any) {
      if (e.code === 'P2025') throw { statusCode: 404, message: 'Not found' }
      throw e
    }
  }

  async share(id: string, userId: string) {
    const existing = await db.project.findFirst({ where: { id, userId } })
    if (!existing) throw { statusCode: 404, message: 'Not found' }

    let shareToken!: string
    await db.$transaction(async (tx) => {
      const share = await tx.projectShare.upsert({
        where: { projectId: id },
        create: { projectId: id },
        update: {},
      })
      await tx.project.update({ where: { id }, data: { visibility: 'PUBLIC' } })
      shareToken = share.shareToken
    })

    return { shareToken }
  }

  async unshare(id: string, userId: string) {
    const existing = await db.project.findFirst({ where: { id, userId } })
    if (!existing) throw { statusCode: 404, message: 'Not found' }

    await db.$transaction([
      db.projectShare.deleteMany({ where: { projectId: id } }),
      db.project.update({ where: { id }, data: { visibility: 'PRIVATE' } }),
    ])
  }

  async getByShareToken(shareToken: string) {
    const share = await db.projectShare.findUnique({
      where: { shareToken },
      include: { project: { include: { share: true } } },
    })
    if (!share || share.project.visibility !== 'PUBLIC') {
      throw { statusCode: 404, message: 'Share link not found' }
    }
    return toFull(share.project)
  }
}

type ProjectWithShare = {
  id: string
  userId: string
  title: string
  documentJson: unknown
  schemaVersion: number
  visibility: string
  thumbnailUrl: string | null
  createdAt: Date
  updatedAt: Date
  share: { shareToken: string } | null
}

function toSummary(p: ProjectWithShare) {
  return {
    id: p.id,
    userId: p.userId,
    title: p.title,
    schemaVersion: p.schemaVersion,
    visibility: p.visibility as 'PRIVATE' | 'PUBLIC',
    thumbnailUrl: p.thumbnailUrl,
    shareToken: p.share?.shareToken ?? null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }
}

function toFull(p: ProjectWithShare) {
  return {
    ...toSummary(p),
    documentJson: p.documentJson,
  }
}
