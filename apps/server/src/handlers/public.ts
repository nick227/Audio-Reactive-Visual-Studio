import { ProjectService } from '../services/ProjectService'

const projectService = new ProjectService()

export async function getSharedProject(request: any, reply: any) {
  const data = await projectService.getByShareToken(request.params.shareToken)
  return reply.send({ data })
}
