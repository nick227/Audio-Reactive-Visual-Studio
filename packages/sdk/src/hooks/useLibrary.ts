import { useQuery } from '@tanstack/react-query'
import { getApiClient, ApiError } from '../client'

export type CloudLibraryAsset = {
  id: string
  title: string
  filename: string
  mimeType: string
  publicUrl: string
  kind: 'image' | 'video' | 'audio'
}

export type LibraryConfig = {
  disabledKeys: string[]
  cloudAssets: CloudLibraryAsset[]
}

export function useLibraryConfig() {
  return useQuery({
    queryKey: ['library', 'config'],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/library/config')
      if (error) throw new ApiError((response as Response).status, (error as { error?: string }).error ?? 'Request failed')
      return data!.data as LibraryConfig
    },
    staleTime: 60_000,
  })
}

export function isLibraryItemEnabled(disabledKeys: string[] | undefined, itemKey: string) {
  return !disabledKeys?.includes(itemKey)
}

export function studioItemKey(assetId: string) {
  return `studio:${assetId}`
}

export function stockItemKey(stockId: string) {
  return `stock:${stockId}`
}
