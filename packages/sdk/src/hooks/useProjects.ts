import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getApiClient, ApiError } from '../client'
import type { components } from '../generated/types'

type CreateProjectInput = components['schemas']['CreateProjectInput']
type UpdateProjectInput = components['schemas']['UpdateProjectInput']

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/projects')
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!.data
    },
    staleTime: 30_000,
  })
}

export function useProject(id: string) {
  return useQuery({
    queryKey: ['projects', id],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/projects/{id}', {
        params: { path: { id } },
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!.data
    },
    enabled: Boolean(id),
    staleTime: 30_000,
  })
}

export function useCreateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateProjectInput) => {
      const { data, error, response } = await getApiClient().POST('/projects', { body: input })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}

export function useUpdateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & UpdateProjectInput) => {
      const { data, error, response } = await getApiClient().PATCH('/projects/{id}', {
        params: { path: { id } },
        body: input,
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!.data
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['projects', id] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}

export function useDeleteProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error, response } = await getApiClient().DELETE('/projects/{id}', {
        params: { path: { id } },
      })
      if (error) throw new ApiError(response.status, (error as any).error)
    },
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: ['projects', id] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}

export function useShareProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error, response } = await getApiClient().POST('/projects/{id}/share', {
        params: { path: { id } },
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!.data
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['projects', id] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}

export function useUnshareProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error, response } = await getApiClient().DELETE('/projects/{id}/share', {
        params: { path: { id } },
      })
      if (error) throw new ApiError(response.status, (error as any).error)
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['projects', id] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}

export function useSharedProject(shareToken: string) {
  return useQuery({
    queryKey: ['shared', shareToken],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/p/{shareToken}', {
        params: { path: { shareToken } },
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!.data
    },
    enabled: Boolean(shareToken),
    staleTime: 60_000,
  })
}
