export type CommunityAsset = {
  id: string
  fileKey: string
  filename: string
  title: string | null
  mimeType: string
  sizeBytes: number
  published: boolean
  publicUrl?: string
  createdAt: string
  updatedAt: string
}
