import { LibraryService } from '../services/LibraryService'

const libraryService = new LibraryService()

export async function getLibraryConfig(request: any, reply: any) {
  const config = await libraryService.getPublicConfig(request)
  return reply.send({ data: config })
}
