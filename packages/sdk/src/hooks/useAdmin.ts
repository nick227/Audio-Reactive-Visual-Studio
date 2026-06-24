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
    },
  })
}
