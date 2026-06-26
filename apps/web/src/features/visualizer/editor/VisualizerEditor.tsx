import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createDefaultProject } from '../project/defaultProject'
import { clearSavedProject } from '../project/projectPersistence'
import type { Project, StagePresetId } from '../project/types'
import { nowIso } from '../entities/entityTypes'
import { isTypographyLayer } from '../runtime/layerVisualKind'
import type { StageHandle } from './Stage'
import { AUDIO_ENCODER_SUPPORTED } from '../export/webcodecs'
import { DEFAULT_PRESET_ID, type PresetId } from '../export/presets'
import { analyzeRendererSupport } from '../export/renderCanvasFrame'
import { idbDelete } from '../storage/idbStorage'
import { SiteTopBar } from '../../../components/SiteTopBar'
import { FrameChunkCache } from '../prerender'
import { applyLayerPatch } from './core/layerPatch'
import { getActiveStagePresetId, stagePresets } from './core/stagePresets'
import { useEditorModal } from './hooks/useEditorModal'
import { useEditorHistory } from './hooks/useEditorHistory'
import { useEditorPersistence } from './hooks/useEditorPersistence'
import { useManagedObjectUrls } from './hooks/useManagedObjectUrls'
import { useMediaLibrary } from './hooks/useMediaLibrary'
import { useLayerActions } from './hooks/useLayerActions'
import { useEditorPlayback } from './hooks/useEditorPlayback'
import { TransportBar } from './components/TransportBar'
import { LayersPanel } from './components/LayersPanel'
import { EditorStageArea } from './components/EditorStageArea'
import { EditorModals } from './components/EditorModals'
import { usePrerenderCache } from './hooks/usePrerenderCache'
import { useEditorExport } from './hooks/useEditorExport'
import { useCloudProjectSync } from './hooks/useCloudProjectSync'

export function VisualizerEditor() {
  const { present: project, patchPresent, commitProject, undo, redo, resetHistory } = useEditorHistory()
  const cloudSync = useCloudProjectSync(project)
  const { localSavedAt } = useEditorPersistence({ project, cloudDirtyRef: cloudSync.cloudDirtyRef })

  const [selectedLayerId, setSelectedLayerId] = useState(() => project.layers[project.layers.length - 1]?.id ?? '')
  const { modal, closeModal, openMediaModal, openSubtitleModal: showSubtitleModal, openVideoSettingsModal, openExportModal } = useEditorModal()
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [fsUiIdle, setFsUiIdle] = useState(false)
  const fsIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const exportActiveRef = useRef(false)
  const stageRef = useRef<StageHandle | null>(null)
  const prerenderCacheRef = useRef(new FrameChunkCache(8, 360))
  const { activeAudioObjectUrlRef, registerObjectUrl, revokeManagedObjectUrl, revokeAllObjectUrls } = useManagedObjectUrls()
  const playback = useEditorPlayback({
    project,
    patchPresent,
    commitProject,
    stageRef,
    exportActiveRef,
    activeAudioObjectUrlRef,
    registerObjectUrl,
    revokeManagedObjectUrl,
  })
  const [preferredExportPresetId, setPreferredExportPresetId] = useState<PresetId>(() => {
    const stored = localStorage.getItem('avl-export-preset-id')
    return (stored === 'draft' || stored === 'standard' || stored === 'high' || stored === 'smooth')
      ? stored
      : DEFAULT_PRESET_ID
  })
  // Renderer diagnostics: computed from current project layers (both for ExportPanel display
  // and to derive rendererMode without a redundant second pass).
  const rendererDiagnostics = useMemo(
    () => analyzeRendererSupport(project.layers),
    [project.layers],
  )
  const rendererMode = rendererDiagnostics.mode
  const hasAudio = Boolean(project.audio?.url)
  const editorExport = useEditorExport({
    project,
    commitProject,
    stageRef,
    playback,
    exportActiveRef,
    prerenderCacheRef,
    preferredExportPresetId,
    setPreferredExportPresetId,
    openExportModal,
  })
  const { prerenderStats } = usePrerenderCache({
    project,
    hasAudio,
    rendererMode,
    isPreparing: editorExport.isPreparing,
    isExportingVideo: editorExport.isExportingVideo,
    preferredExportPresetId,
    prerenderCacheRef,
    stageRef,
    playbackTimeMsRef: playback.playbackTimeMsRef,
  })
  const mediaLibrary = useMediaLibrary({
    project,
    patchPresent,
    commitProject,
    audioRef: playback.audioRef,
    activeAudioObjectUrlRef,
    registerObjectUrl,
    setSelectedLayerId,
    setPeaks: playback.setPeaks,
    closeModal,
  })
  const layerActions = useLayerActions({
    selectedLayerId,
    setSelectedLayerId,
    patchPresent,
    commitProject,
    closeModal,
    openSubtitleModal: showSubtitleModal,
  })

  const activeStagePreset = useMemo(
    () => getActiveStagePresetId(project.stage.width, project.stage.height),
    [project.stage.height, project.stage.width],
  )

  // If the selected layer was removed by undo/redo, fall back to the topmost layer.
  useEffect(() => {
    if (selectedLayerId && !project.layers.find((l) => l.id === selectedLayerId)) {
      setSelectedLayerId(project.layers[project.layers.length - 1]?.id ?? '')
    }
  }, [project.layers, selectedLayerId])

  // Clicking outside the stage canvas deselects all layers.
  // Layer pointerdowns call stopPropagation so they never reach this handler.
  useEffect(() => {
    const handler = (e: PointerEvent) => {
      const stageEl = stageRef.current?.getStageElement()
      if (stageEl && !stageEl.contains(e.target as Node)) {
        setSelectedLayerId('')
      }
    }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [])

  const togglePlaybackRef = useRef<() => void>(() => {})

  // ── Text editing ─────────────────────────────────────────────────────────────

  const [textEditLayerId, setTextEditLayerId] = useState<string | null>(null)
  const textEditLayerIdRef = useRef<string | null>(null)
  textEditLayerIdRef.current = textEditLayerId

  const handleLayerDoubleClick = useCallback((layerId: string) => {
    const layer = project.layers.find((l) => l.id === layerId)
    if (layer && isTypographyLayer(layer)) setTextEditLayerId(layerId)
  }, [project.layers])

  const handleTextChange = useCallback((layerId: string, text: string) => {
    patchPresent((p) => ({ ...p, layers: applyLayerPatch(p.layers, layerId, { settings: { text } }) }))
  }, [patchPresent])

  const handleTextCommit = useCallback((layerId: string, text: string) => {
    if (textEditLayerIdRef.current !== layerId) return
    commitProject((p) => ({ ...p, layers: applyLayerPatch(p.layers, layerId, { settings: { text } }) }))
    setTextEditLayerId(null)
  }, [commitProject])

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return
      if (e.key === ' ') { e.preventDefault(); togglePlaybackRef.current(); return }
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      if ((e.key === 'z' && e.shiftKey) || e.key === 'y') { e.preventDefault(); redo() }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [undo, redo])

  // ── Full-screen idle ─────────────────────────────────────────────────────────

  const resetFsIdleTimer = useCallback(() => {
    setFsUiIdle(false)
    if (fsIdleTimerRef.current) clearTimeout(fsIdleTimerRef.current)
    fsIdleTimerRef.current = setTimeout(() => setFsUiIdle(true), 2500)
  }, [])

  useEffect(() => {
    if (isFullScreen) {
      resetFsIdleTimer()
      return () => { if (fsIdleTimerRef.current) clearTimeout(fsIdleTimerRef.current) }
    } else {
      if (fsIdleTimerRef.current) clearTimeout(fsIdleTimerRef.current)
      setFsUiIdle(false)
    }
  }, [isFullScreen, resetFsIdleTimer])

  useEffect(() => {
    if (!isFullScreen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsFullScreen(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isFullScreen])

  // ── Project-level operations ─────────────────────────────────────────────────

  const resetProject = useCallback(() => {
    if (!window.confirm('Start a new project? All layers and unsaved changes will be cleared.')) return
    playback.stopPlayback()
    // Cleanup IDB entries for uploaded files in the current project
    for (const layer of project.layers) {
      if (typeof layer.settings.srcKey === 'string') void idbDelete(String(layer.settings.srcKey))
    }
    if (project.audio?.fileKey) void idbDelete(project.audio.fileKey)
    clearSavedProject()
    revokeAllObjectUrls()
    if (playback.audioRef.current) playback.audioRef.current.src = ''
    const fresh = createDefaultProject()
    resetHistory(fresh)
    setSelectedLayerId(fresh.layers[fresh.layers.length - 1]?.id ?? '')
    playback.resetPlaybackUi()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.audio?.fileKey, project.layers])

  togglePlaybackRef.current = () => { void playback.togglePlayback() }

  // ── Stage preset ─────────────────────────────────────────────────────────────

  const setStagePreset = (presetId: StagePresetId) => {
    const preset = stagePresets.find((p) => p.id === presetId)
    if (!preset) return
    commitProject((current) => ({
      ...current,
      stage: { ...current.stage, width: preset.width, height: preset.height, preset: preset.id, updatedAt: nowIso() },
    }))
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div
      className={`app-shell${isFullScreen ? ' full-screen' : ''}${isFullScreen && fsUiIdle ? ' fs-ui-idle' : ''}`}
      onPointerMove={isFullScreen ? resetFsIdleTimer : undefined}
    >
      <audio ref={playback.audioRef} onEnded={playback.onAudioEnded} />

      {!isFullScreen && (
        <SiteTopBar
          onSaveToCloud={cloudSync.me ? cloudSync.handleSaveToCloud : undefined}
          isSaving={cloudSync.isSaving}
          lastCloudSaved={cloudSync.lastSaved}
          localSavedAt={localSavedAt}
        />
      )}

      <div className={`editor-body ${activeStagePreset}-screen${isFullScreen ? ' full-screen' : ''}`}>

        <EditorStageArea
          stageRef={stageRef}
          project={editorExport.stageProject}
          activeStagePreset={activeStagePreset}
          selectedLayerId={selectedLayerId}
          isPlaying={playback.isPlaying}
          isFullScreen={isFullScreen}
          editingLayerId={textEditLayerId}
          currentTimeMs={playback.currentTimeMs}
          onSetStagePreset={setStagePreset}
          onToggleFullScreen={() => setIsFullScreen((v) => !v)}
          onSelectLayer={(id) => {
            setSelectedLayerId(id)
            if (id !== textEditLayerIdRef.current) setTextEditLayerId(null)
          }}
          onUpdateLayer={layerActions.updateLayerTransient}
          onDragStart={layerActions.snapshotForDrag}
          onDoubleClickLayer={handleLayerDoubleClick}
          onTextChange={handleTextChange}
          onTextCommit={handleTextCommit}
        />

        <TransportBar hasAudio={hasAudio} audioFilename={project.audio?.filename} playback={playback} />

        {/* ── Layers ── */}
        {!isFullScreen && (
          <LayersPanel
            project={project}
            selectedLayerId={selectedLayerId}
            currentTimeMs={playback.currentTimeMs}
            hasAudio={hasAudio}
            isExportingVideo={editorExport.isExportingVideo}
            exportVideoProgress={editorExport.exportVideoProgress}
            layerActions={layerActions}
            onSelectLayer={setSelectedLayerId}
            onOpenExport={openExportModal}
            onCancelExport={editorExport.cancelVideoExport}
            onOpenMedia={openMediaModal}
            onEditVideoLayer={openVideoSettingsModal}
          />
        )}

      </div>

      <EditorModals
        modal={modal}
        project={project}
        mediaLibrary={mediaLibrary}
        layerActions={layerActions}
        waveformPeaks={playback.peaks}
        closeModal={closeModal}
        exportState={{
          hasAudio,
          suggestedTitle: editorExport.suggestedExportTitle,
          isExportingPng: editorExport.isExporting,
          isPreparing: editorExport.isPreparing,
          preparePhase: editorExport.preparePhase,
          prepareProgress: editorExport.prepareProgress,
          isExportingVideo: editorExport.isExportingVideo,
          videoProgress: editorExport.exportVideoProgress,
          exportPhase: editorExport.exportPhase,
          rendererMode,
          rendererDiagnostics,
          hasAudioEncoder: AUDIO_ENCODER_SUPPORTED,
          exportStats: editorExport.exportStats,
          prerenderStats,
          initialPresetId: preferredExportPresetId,
          lastExport: editorExport.lastExport,
          onPresetChange: setPreferredExportPresetId,
          onExportPng: (title) => void editorExport.exportPng(title),
          onExportWebm: editorExport.beginExportWebm,
          onCancelVideo: editorExport.cancelVideoExport,
          onDownloadLastExport: () => void editorExport.downloadLastExport(),
          onClearLastExport: editorExport.clearLastExport,
        }}
      />
    </div>
  )
}
