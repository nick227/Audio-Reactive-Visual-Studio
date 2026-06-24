const DEFAULT_PROJECT_NAME = 'Untitled Visualizer'

export function suggestExportTitle(audioFilename?: string, projectName?: string): string {
  if (audioFilename) {
    const base = audioFilename.replace(/\.[^.]+$/, '')
    const cleaned = base.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
    if (cleaned) return cleaned
  }
  if (projectName && projectName !== DEFAULT_PROJECT_NAME) return projectName
  return DEFAULT_PROJECT_NAME
}

export function exportFileBase(title: string): string {
  const slug = title.trim().replace(/\s+/g, '-').replace(/[^\w.-]+/g, '').toLowerCase()
  return slug || 'export'
}
