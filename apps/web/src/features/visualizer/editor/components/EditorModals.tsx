import type { LayerInstance, Project } from '../../project/types'
import type { ExportPreset, PresetId } from '../../export/presets'
import type { RendererDiagnostics } from '../../export/rendererSupport'
import type { FrameStats, WebCodecsExportPhase } from '../../export/webcodecs'
import type { CachedChunkStats } from '../../prerender'
import type { LastExportMeta } from '../core/exportMeta'
import type { EditorModal } from '../hooks/useEditorModal'
import type { MediaLibraryItem } from '../hooks/useMediaLibrary'
import { ExportPanel } from '../ExportPanel'
import { MediaModal } from '../MediaModal'
import { SubtitleModal } from '../SubtitleModal'
import { VideoSettingsModal } from '../VideoSettingsModal'

type MediaLibrary = {
  sessionUploads: MediaLibraryItem[]
  sessionVideos: MediaLibraryItem[]
  addUploadedImage: (file: File) => Promise<void>
  addUploadedVideo: (file: File) => Promise<void>
  reuseUpload: (url: string, name: string, fileKey: string) => void
  reuseVideo: (url: string, name: string, fileKey: string) => void
}

type LayerActions = {
  addTemplate: (templateId: string) => void
  updateLayer: (layerId: string, patch: Partial<LayerInstance>) => void
  updateSubtitleLayerCues: (layerId: string, cues: import('../../subtitles/parseSrt').SrtCue[]) => void
}

type ExportState = {
  hasAudio: boolean
  suggestedTitle: string
  isExportingPng: boolean
  isPreparing: boolean
  preparePhase: string
  prepareProgress: number
  isExportingVideo: boolean
  videoProgress: number
  exportPhase: WebCodecsExportPhase | ''
  rendererMode: 'native' | 'compat'
  rendererDiagnostics: RendererDiagnostics | null
  hasAudioEncoder: boolean
  exportStats: FrameStats | null
  prerenderStats: CachedChunkStats
  initialPresetId: PresetId
  lastExport: LastExportMeta | null
  onPresetChange: (presetId: PresetId) => void
  onExportPng: (title: string) => void
  onExportWebm: (title: string, preset: ExportPreset) => void
  onCancelVideo: () => void
  onDownloadLastExport: () => void
  onClearLastExport: () => void
}

type EditorModalsProps = {
  modal: EditorModal
  project: Project
  mediaLibrary: MediaLibrary
  layerActions: LayerActions
  waveformPeaks: number[]
  exportState: ExportState
  closeModal: () => void
}

export function EditorModals({
  modal,
  project,
  mediaLibrary,
  layerActions,
  waveformPeaks,
  exportState,
  closeModal,
}: EditorModalsProps) {
  if (modal?.type === 'media') {
    return (
      <MediaModal
        onClose={closeModal}
        onAddTemplate={layerActions.addTemplate}
        onUploadImage={(file) => void mediaLibrary.addUploadedImage(file)}
        onUploadVideo={(file) => void mediaLibrary.addUploadedVideo(file)}
        uploadedImages={mediaLibrary.sessionUploads}
        uploadedVideos={mediaLibrary.sessionVideos}
        onReuseImage={mediaLibrary.reuseUpload}
        onReuseVideo={mediaLibrary.reuseVideo}
      />
    )
  }

  if (modal?.type === 'subtitle') {
    const editingLayer = project.layers.find((layer) => layer.id === modal.layerId) ?? null
    if (!editingLayer) return null
    return (
      <SubtitleModal
        onClose={closeModal}
        onSave={(cues) => layerActions.updateSubtitleLayerCues(modal.layerId, cues)}
        editingLayer={editingLayer}
        onUpdateLayer={(patch) => layerActions.updateLayer(modal.layerId, patch)}
        waveformPeaks={waveformPeaks}
        audioSrc={project.audio?.url ?? null}
        audioDuration={project.audio?.duration ?? 0}
      />
    )
  }

  if (modal?.type === 'video-settings') {
    const videoLayer = project.layers.find((layer) => layer.id === modal.layerId) ?? null
    if (!videoLayer) return null
    return (
      <VideoSettingsModal
        layer={videoLayer}
        onClose={closeModal}
        onUpdate={(patch) => layerActions.updateLayer(modal.layerId, patch)}
      />
    )
  }

  if (modal?.type === 'export') {
    return (
      <ExportPanel
        hasAudio={exportState.hasAudio}
        suggestedTitle={exportState.suggestedTitle}
        isExportingPng={exportState.isExportingPng}
        isPreparing={exportState.isPreparing}
        preparePhase={exportState.preparePhase}
        prepareProgress={exportState.prepareProgress}
        isExportingVideo={exportState.isExportingVideo}
        videoProgress={exportState.videoProgress}
        exportPhase={exportState.exportPhase}
        rendererMode={exportState.rendererMode}
        rendererDiagnostics={exportState.rendererDiagnostics}
        hasAudioEncoder={exportState.hasAudioEncoder}
        exportStats={exportState.exportStats}
        prerenderStats={exportState.prerenderStats}
        initialPresetId={exportState.initialPresetId}
        onPresetChange={exportState.onPresetChange}
        onExportPng={exportState.onExportPng}
        onExportWebm={exportState.onExportWebm}
        onCancelVideo={exportState.onCancelVideo}
        lastExport={exportState.lastExport}
        onDownloadLastExport={exportState.onDownloadLastExport}
        onClearLastExport={exportState.onClearLastExport}
        onClose={() => {
          if (exportState.isExportingVideo) return
          closeModal()
        }}
      />
    )
  }

  return null
}
