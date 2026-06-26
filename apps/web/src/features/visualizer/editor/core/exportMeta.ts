export type LastExportMeta = {
  filename: string
  mimeType: string
}

const LAST_EXPORT_META_KEY = 'avl-export-webm-meta'

export function loadLastExportMeta(): LastExportMeta | null {
  try {
    const raw = localStorage.getItem(LAST_EXPORT_META_KEY)
    return raw ? (JSON.parse(raw) as LastExportMeta) : null
  } catch {
    return null
  }
}

export function saveLastExportMeta(meta: LastExportMeta): void {
  localStorage.setItem(LAST_EXPORT_META_KEY, JSON.stringify(meta))
}

export function clearLastExportMeta(): void {
  localStorage.removeItem(LAST_EXPORT_META_KEY)
}
