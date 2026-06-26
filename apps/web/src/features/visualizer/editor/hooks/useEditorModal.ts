import { useCallback, useState } from 'react'

export type EditorModal =
  | { type: 'media' }
  | { type: 'subtitle'; layerId: string }
  | { type: 'video-settings'; layerId: string }
  | { type: 'export' }
  | null

export function useEditorModal() {
  const [modal, setModal] = useState<EditorModal>(null)

  const closeModal = useCallback(() => setModal(null), [])
  const openMediaModal = useCallback(() => setModal({ type: 'media' }), [])
  const openSubtitleModal = useCallback((layerId: string) => setModal({ type: 'subtitle', layerId }), [])
  const openVideoSettingsModal = useCallback((layerId: string) => {
    setModal({ type: 'video-settings', layerId })
  }, [])
  const openExportModal = useCallback(() => setModal({ type: 'export' }), [])

  return {
    modal,
    setModal,
    closeModal,
    openMediaModal,
    openSubtitleModal,
    openVideoSettingsModal,
    openExportModal,
  }
}
