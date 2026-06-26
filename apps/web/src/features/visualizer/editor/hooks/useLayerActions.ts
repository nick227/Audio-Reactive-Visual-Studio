import { useCallback } from 'react'
import { assetRegistry } from '../../assets/registry'
import { createEntityId, nowIso } from '../../entities/entityTypes'
import type { SrtCue } from '../../subtitles/parseSrt'
import type { LayerInstance, Project } from '../../project/types'
import { applyLayerPatch } from '../core/layerPatch'

type UseLayerActionsParams = {
  selectedLayerId: string
  setSelectedLayerId: (layerId: string) => void
  patchPresent: (recipe: (current: Project) => Project) => void
  commitProject: (recipe: (current: Project) => Project) => void
  closeModal: () => void
  openSubtitleModal: (layerId: string) => void
}

export function useLayerActions({
  selectedLayerId,
  setSelectedLayerId,
  patchPresent,
  commitProject,
  closeModal,
  openSubtitleModal,
}: UseLayerActionsParams) {
  const updateLayer = useCallback((layerId: string, patch: Partial<LayerInstance>) => {
    commitProject((current) => ({ ...current, layers: applyLayerPatch(current.layers, layerId, patch) }))
  }, [commitProject])

  const updateLayerTransient = useCallback((layerId: string, patch: Partial<LayerInstance>) => {
    patchPresent((current) => ({ ...current, layers: applyLayerPatch(current.layers, layerId, patch) }))
  }, [patchPresent])

  const snapshotForDrag = useCallback(() => {
    commitProject((current) => current)
  }, [commitProject])

  const addTemplate = useCallback((templateId: string) => {
    const template = assetRegistry.get(templateId)
    if (!template) return
    const layer = template.createLayer()
    commitProject((current) => ({ ...current, layers: [...current.layers, layer] }))
    setSelectedLayerId(layer.id)
    closeModal()
  }, [closeModal, commitProject, setSelectedLayerId])

  const openSubtitleEditor = useCallback((layerId?: string) => {
    if (layerId) {
      setSelectedLayerId(layerId)
      openSubtitleModal(layerId)
      return
    }

    const template = assetRegistry.get('subtitle-layer')
    if (!template) return
    const layer = template.createLayer()
    commitProject((current) => ({ ...current, layers: [...current.layers, layer] }))
    setSelectedLayerId(layer.id)
    openSubtitleModal(layer.id)
  }, [commitProject, openSubtitleModal, setSelectedLayerId])

  const updateSubtitleLayerCues = useCallback((layerId: string, cues: SrtCue[]) => {
    commitProject((current) => ({ ...current, layers: applyLayerPatch(current.layers, layerId, { settings: { cues } }) }))
  }, [commitProject])

  const removeLayer = useCallback((layerId: string) => {
    commitProject((current) => ({ ...current, layers: current.layers.filter((layer) => layer.id !== layerId) }))
    if (selectedLayerId === layerId) setSelectedLayerId('')
  }, [commitProject, selectedLayerId, setSelectedLayerId])

  const duplicateLayer = useCallback((layerId: string) => {
    let duplicatedLayerId = ''

    commitProject((current) => {
      const index = current.layers.findIndex((layer) => layer.id === layerId)
      const source = current.layers[index]
      if (!source) return current

      const timestamp = nowIso()
      const duplicate: LayerInstance = {
        ...source,
        id: createEntityId('layer'),
        createdAt: timestamp,
        updatedAt: timestamp,
        name: `${source.name} Copy`,
        placement: { ...source.placement },
        reaction: { ...source.reaction },
        settings: structuredClone(source.settings),
        timing: source.timing
          ? {
              ...source.timing,
              gaps: source.timing.gaps.map((gap) => ({
                ...gap,
                id: createEntityId('gap'),
              })),
            }
          : undefined,
      }

      duplicatedLayerId = duplicate.id
      return {
        ...current,
        layers: [
          ...current.layers.slice(0, index + 1),
          duplicate,
          ...current.layers.slice(index + 1),
        ],
      }
    })

    if (duplicatedLayerId) setSelectedLayerId(duplicatedLayerId)
  }, [commitProject, setSelectedLayerId])

  const reorderLayers = useCallback((layers: LayerInstance[]) => {
    commitProject((current) => ({ ...current, layers }))
  }, [commitProject])

  return {
    updateLayer,
    updateLayerTransient,
    snapshotForDrag,
    addTemplate,
    openSubtitleEditor,
    editSubtitleLayer: openSubtitleEditor,
    updateSubtitleLayerCues,
    removeLayer,
    duplicateLayer,
    reorderLayers,
  }
}
