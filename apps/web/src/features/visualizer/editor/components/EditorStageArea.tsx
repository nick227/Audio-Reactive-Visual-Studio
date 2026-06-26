import type { RefObject } from 'react'
import { Maximize2, Minimize2 } from 'lucide-react'
import type { LayerInstance, Project, StagePresetId } from '../../project/types'
import { stagePresets } from '../core/stagePresets'
import { Stage, type StageHandle } from '../Stage'

type EditorStageAreaProps = {
  stageRef: RefObject<StageHandle | null>
  project: Project
  activeStagePreset: StagePresetId
  selectedLayerId: string
  isPlaying: boolean
  isFullScreen: boolean
  editingLayerId: string | null
  currentTimeMs: number
  onSetStagePreset: (presetId: StagePresetId) => void
  onToggleFullScreen: () => void
  onSelectLayer: (layerId: string) => void
  onUpdateLayer: (layerId: string, patch: Partial<LayerInstance>) => void
  onDragStart: () => void
  onDoubleClickLayer: (layerId: string) => void
  onTextChange: (layerId: string, text: string) => void
  onTextCommit: (layerId: string, text: string) => void
}

export function EditorStageArea({
  stageRef,
  project,
  activeStagePreset,
  selectedLayerId,
  isPlaying,
  isFullScreen,
  editingLayerId,
  currentTimeMs,
  onSetStagePreset,
  onToggleFullScreen,
  onSelectLayer,
  onUpdateLayer,
  onDragStart,
  onDoubleClickLayer,
  onTextChange,
  onTextCommit,
}: EditorStageAreaProps) {
  return (
    <div className="stage-area">
      <div className="stage-controls">
        <div className="preset-switcher">
          {stagePresets.map((preset) => {
            const Icon = preset.icon
            return (
              <button
                key={preset.id}
                className={activeStagePreset === preset.id ? 'active' : ''}
                onClick={() => onSetStagePreset(preset.id)}
                title={`${preset.label} · ${preset.width} × ${preset.height}`}
              >
                <Icon size={13} />
              </button>
            )
          })}
        </div>
        <button
          className="fs-toggle-btn"
          onClick={onToggleFullScreen}
          title={isFullScreen ? 'Exit full screen (Esc)' : 'Full screen'}
        >
          {isFullScreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
        </button>
      </div>
      <div className="stage-viewport">
        <Stage
          ref={stageRef}
          project={project}
          selectedLayerId={selectedLayerId}
          isPlaying={isPlaying}
          onSelectLayer={onSelectLayer}
          onUpdateLayer={onUpdateLayer}
          onDragStart={onDragStart}
          onDoubleClickLayer={onDoubleClickLayer}
          editingLayerId={editingLayerId}
          onTextChange={onTextChange}
          onTextCommit={onTextCommit}
          currentTimeMs={currentTimeMs}
        />
      </div>
    </div>
  )
}
