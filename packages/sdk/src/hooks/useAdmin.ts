import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getApiClient, ApiError } from '../client'

// ── Users ──────────────────────────────────────────────────────────────────

export function useAdminUsers() {
  return useQuery({
    queryKey: ['admin', 'users'],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/admin/users')
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
  })
}

export function useUpdateAdminUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string; role?: 'USER' | 'ADMIN'; suspended?: boolean }) => {
      const { data, error, response } = await getApiClient().PATCH('/admin/users/{id}', {
        params: { path: { id } },
        body,
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
    },
  })
}

export function useDeleteAdminUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error, response } = await getApiClient().DELETE('/admin/users/{id}', {
        params: { path: { id } },
      })
      if (error) throw new ApiError(response.status, (error as any).error)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
    },
  })
}

// ── Community assets ───────────────────────────────────────────────────────

export function useCommunityAssets() {
  return useQuery({
    queryKey: ['admin', 'community-assets'],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/admin/community-assets')
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
  })
}

export function useUpdateCommunityAsset() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string; title?: string | null; published?: boolean }) => {
      const { data, error, response } = await getApiClient().PATCH('/admin/community-assets/{id}', {
        params: { path: { id } },
        body,
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'community-assets'] })
      queryClient.invalidateQueries({ queryKey: ['library', 'config'] })
    },
  })
}

export function useDeleteCommunityAsset() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error, response } = await getApiClient().DELETE('/admin/community-assets/{id}', {
        params: { path: { id } },
      })
      if (error) throw new ApiError(response.status, (error as any).error)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'community-assets'] })
      queryClient.invalidateQueries({ queryKey: ['library', 'config'] })
    },
  })
}

export function useUploadCommunityAsset() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) => {
      const mimeType = file.type || 'application/octet-stream'
      const { data: urlData, error: urlErr, response: urlRes } = await getApiClient().POST(
        '/admin/community-assets/upload-url',
        { body: { filename: file.name, mimeType, sizeBytes: file.size, title: file.name } },
      )
      if (urlErr) throw new ApiError(urlRes.status, (urlErr as { error?: string }).error ?? 'Upload URL failed')

      const putRes = await fetch(urlData!.data.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': mimeType },
        credentials: 'include',
      })
      if (!putRes.ok) throw new Error(`Upload failed (${putRes.status})`)

      const { data, error, response } = await getApiClient().POST('/admin/community-assets/complete', {
        body: {
          fileKey: urlData!.data.fileKey,
          filename: file.name,
          mimeType,
          sizeBytes: file.size,
          title: file.name,
        },
      })
      if (error) throw new ApiError(response.status, (error as { error?: string }).error ?? 'Complete failed')
      return data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'community-assets'] })
      queryClient.invalidateQueries({ queryKey: ['library', 'config'] })
    },
  })
}

export function useLibraryOverrides() {
  return useQuery({
    queryKey: ['admin', 'library-overrides'],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/admin/library/overrides')
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
  })
}

export function useSetLibraryItemEnabled() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ itemKey, enabled }: { itemKey: string; enabled: boolean }) => {
      const { data, error, response } = await getApiClient().PATCH('/admin/library/items/{itemKey}', {
        params: { path: { itemKey: encodeURIComponent(itemKey) } },
        body: { enabled },
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'library-overrides'] })
      queryClient.invalidateQueries({ queryKey: ['library', 'config'] })
    },
  })
}
