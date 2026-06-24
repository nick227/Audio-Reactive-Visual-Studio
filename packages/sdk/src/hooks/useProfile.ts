import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getApiClient, ApiError } from '../client'

export function useProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/profile')
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    staleTime: 30_000,
  })
}

export function useUpdateProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: { displayName?: string; avatarUrl?: string | null }) => {
      const { data, error, response } = await getApiClient().PATCH('/profile', { body })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      queryClient.invalidateQueries({ queryKey: ['me'] })
    },
  })
}

export function useRequestPasswordReset() {
  return useMutation({
    mutationFn: async (email: string) => {
      const { error, response } = await getApiClient().POST('/auth/password-reset/request', {
        body: { email },
      })
      if (error) throw new ApiError(response.status, (error as any).error)
    },
  })
}

export function useConfirmPasswordReset() {
  return useMutation({
    mutationFn: async (body: { token: string; newPassword: string }) => {
      const { error, response } = await getApiClient().POST('/auth/password-reset/confirm', {
        body,
      })
      if (error) throw new ApiError(response.status, (error as any).error)
    },
  })
}
