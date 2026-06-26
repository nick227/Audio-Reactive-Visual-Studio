import { LibraryService } from '../services/LibraryService'

const libraryService = new LibraryService()

export async function getLibraryConfig(_request: any, reply: any) {
  const config = await libraryService.getPublicConfig()
  return reply.send({ data: config })
}
