import { getApiBaseUrl } from './apiBaseUrl'

export function getCommunityMediaUrl(fileKey: string) {
  const encoded = fileKey.split('/').map(encodeURIComponent).join('/')
  return `${getApiBaseUrl().replace(/\/$/, '')}/media/community/${encoded}`
}
