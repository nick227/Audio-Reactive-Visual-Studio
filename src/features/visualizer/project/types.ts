import type { EntityBase, EntityId } from '../entities/entityTypes'

export type AudioTrigger = 'none' | 'bass' | 'beat' | 'vocals' | 'highs' | 'full'
export type ExtraEffect = 'none' | 'float' | 'rotate' | 'drift' | 'shake' | 'glow' | 'flicker' | 'particles'
export type SubtitleStyle = 'cinematic' | 'pop' | 'karaoke' | 'retro' | 'minimal'
export type FitMode = 'contain' | 'cover' | 'original' | 'stretch' | 'custom'
export type StagePresetId = 'mobile' | 'desktop' | 'film'
export type AssetCategory =
  | 'images-cutouts'
  | 'textures'
  | 'gradients'
  | 'particles'
  | 'shapes'
  | 'frames'
  | 'typography'
  | 'audio-visualizers'
  | 'three-objects'
  | 'motion-effects'
  | 'puppets'
  | 'subtitles'

export type AssetCollection =
  | 'backgrounds'
  | 'visualizers'
  | 'particles'
  | 'objects'
  | 'type-frames'
  | 'fx-overlays'
  | 'puppets'
  | 'uploads'
  | 'transcript'

export type RendererType = 'image' | 'dom' | 'canvas' | 'three'

export type LayerPlacement = {
  fit: FitMode
  x: number
  y: number
  scale: number
  rotation: number
  opacity: number
  anchor: 'center'
}

export type LayerReaction = {
  trigger: AudioTrigger
  pulseAmount: number
  extraEffect: ExtraEffect
  extraAmount: number
  smoothness: number
}

export type LayerVisibilityGap = {
  id: string
  startMs: number
  endMs: number
}

export type LayerTiming = {
  mode: 'always' | 'gaps'
  gaps: LayerVisibilityGap[]
}

export const DEFAULT_LAYER_TIMING: LayerTiming = { mode: 'always', gaps: [] }

export type LayerInstance = EntityBase<'layer'> & {
  templateId: EntityId
  name: string
  role?: string
  visible: boolean
  locked: boolean
  placement: LayerPlacement
  reaction: LayerReaction
  settings: Record<string, unknown>
  timing?: LayerTiming
}

export type AudioTrackEntity = EntityBase<'audio-track'> & {
  url: string
  filename: string
  duration: number
  fileKey?: string
}

export type StageEntity = EntityBase<'stage'> & {
  width: number
  height: number
  backgroundColor: string
  preset?: StagePresetId
}

export type Project = EntityBase<'project'> & {
  name: string
  schemaVersion: 1
  audio?: AudioTrackEntity
  stage: StageEntity
  layers: LayerInstance[]
  microEvents?: CompositionMicroEvent[]
}

export type AssetControl = {
  key: string
  label: string
  type: 'slider' | 'color' | 'select' | 'text'
  min?: number
  max?: number
  step?: number
  options?: string[]
}

export type AssetTemplate = EntityBase<'asset-template'> & {
  name: string
  category: AssetCategory
  collection?: AssetCollection
  tags?: string[]
  renderer: RendererType
  description: string
  thumbnail: string
  defaultLayer: Partial<LayerInstance>
  controls: AssetControl[]
  createLayer: (overrides?: Partial<LayerInstance>) => LayerInstance
}


export type CompositionLayerSeed = {
  templateId: EntityId
  name?: string
  role?: string
  placement?: Partial<LayerPlacement>
  reaction?: Partial<LayerReaction>
  settings?: Record<string, unknown>
}

export type CompositionMicroEvent = {
  id: string
  name: string
  trigger: 'strongBeat' | 'bassPeak' | 'highSpark' | 'randomInterval'
  probability: number
  cooldownMs: number
  targetRole: string
  effect: 'flash' | 'invert' | 'jitter' | 'burst' | 'duplicate' | 'wipe'
}

export type CompositionTemplate = {
  id: EntityId
  name: string
  collection: AssetCollection
  thumbnail: string
  description: string
  layerCount: number
  controls: string[]
  microEvents: CompositionMicroEvent[]
  layers: CompositionLayerSeed[]
}
