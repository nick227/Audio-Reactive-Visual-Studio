import { Captions, Plus } from 'lucide-react'
import type { LayerInstance, Project } from '../../project/types'
import { AssetList } from '../AssetList'
import { DownloadMediaButton } from './DownloadMediaButton'

type LayerActions = {
  updateLayer: (layerId: string, patch: Partial<LayerInstance>) => void
  updateLayerTransient: (layerId: string, patch: Partial<LayerInstance>) => void
  snapshotForDrag: () => void
  removeLayer: (layerId: string) => void
  reorderLayers: (layers: LayerInstance[]) => void
  editSubtitleLayer: (layerId: string) => void
  openSubtitleEditor: (layerId?: string) => void
}

type LayersPanelProps = {
  project: Project
  selectedLayerId: string
  currentTimeMs: number
  hasAudio: boolean
  isExportingVideo: boolean
  exportVideoProgress: number
  layerActions: LayerActions
  onSelectLayer: (layerId: string) => void
  onOpenExport: () => void
  onCancelExport: () => void
  onOpenMedia: () => void
  onEditVideoLayer: (layerId: string) => void
}

export function LayersPanel({
  project,
  selectedLayerId,
  currentTimeMs,
  hasAudio,
  isExportingVideo,
  exportVideoProgress,
  layerActions,
  onSelectLayer,
  onOpenExport,
  onCancelExport,
  onOpenMedia,
  onEditVideoLayer,
}: LayersPanelProps) {
  return (
    <>
      <div className="layers-header">
        <DownloadMediaButton
          hasAudio={hasAudio}
          isExportingVideo={isExportingVideo}
          progress={exportVideoProgress}
          onStart={onOpenExport}
          onCancel={onCancelExport}
        />
        <button className="layers-add-btn layers-add-subtitle-btn" onClick={() => layerActions.openSubtitleEditor()}>
          <Captions size={13} /> Add Subtitles
        </button>
        <button className="layers-add-btn" onClick={onOpenMedia}>
          <Plus size={13} /> Add Layer
        </button>
      </div>
      <AssetList
        layers={project.layers}
        selectedLayerId={selectedLayerId}
        durationMs={(project.audio?.duration ?? 0) * 1000}
        currentTimeMs={currentTimeMs}
        onSelect={onSelectLayer}
        onUpdate={layerActions.updateLayer}
        onUpdateTransient={layerActions.updateLayerTransient}
        onTimingDragStart={layerActions.snapshotForDrag}
        onRemove={layerActions.removeLayer}
        onReorder={layerActions.reorderLayers}
        onEditSubtitleLayer={layerActions.editSubtitleLayer}
        onEditVideoLayer={onEditVideoLayer}
      />
    </>
  )
}
