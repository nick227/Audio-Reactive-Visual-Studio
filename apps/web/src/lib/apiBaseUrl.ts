const productionApiUrl = 'https://server-music-visualizer.up.railway.app'

export function getApiBaseUrl() {
  return import.meta.env.VITE_API_URL ?? (import.meta.env.PROD ? productionApiUrl : 'http://localhost:3001')
}
