import { ProjectService } from '../services/ProjectService'

const projectService = new ProjectService()

export async function listProjects(request: any, reply: any) {
  const data = await projectService.list(request.user.id)
  return reply.send({ data })
}

export async function createProject(request: any, reply: any) {
  const data = await projectService.create(request.user.id, request.body)
  return reply.status(201).send({ data })
}

export async function getProject(request: any, reply: any) {
  const data = await projectService.get(request.params.id, request.user.id)
  return reply.send({ data })
}

export async function updateProject(request: any, reply: any) {
  const data = await projectService.update(request.params.id, request.user.id, request.body)
  return reply.send({ data })
}

export async function deleteProject(request: any, reply: any) {
  await projectService.delete(request.params.id, request.user.id)
  return reply.status(204).send()
}

export async function shareProject(request: any, reply: any) {
  const data = await projectService.share(request.params.id, request.user.id)
  return reply.send({ data })
}

export async function unshareProject(request: any, reply: any) {
  await projectService.unshare(request.params.id, request.user.id)
  return reply.status(204).send()
}
