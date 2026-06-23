import type {
  AssetCategory,
  AssetCollection,
  AssetTemplate,
  AudioTrigger,
  ExtraEffect,
  FitMode,
  RendererType,
} from '../project/types'
import { createLayerFromTemplate } from '../project/createLayer'
import { nowIso } from '../entities/entityTypes'
import { listDances } from '../puppets/sequences'
import { listOutfits } from '../puppets/outfits'

type StudioAssetDefinition = {
  id: string
  name: string
  category: AssetCategory
  collection: AssetCollection
  renderer?: RendererType
  description: string
  thumbnail: string
  tags?: string[]
  fit?: FitMode
  scale?: number
  opacity?: number
  x?: number
  y?: number
  rotation?: number
  trigger?: AudioTrigger
  pulseAmount?: number
  extraEffect?: ExtraEffect
  extraAmount?: number
  smoothness?: number
  settings?: Record<string, unknown>
}

function template(t: Omit<AssetTemplate, 'createLayer' | 'kind' | 'createdAt' | 'updatedAt'>): AssetTemplate {
  const timestamp = nowIso()
  const asset = {
    ...t,
    kind: 'asset-template' as const,
    createdAt: timestamp,
    updatedAt: timestamp,
  } as AssetTemplate

  asset.createLayer = (overrides) => createLayerFromTemplate(asset, overrides)
  return asset
}

function studioAsset(def: StudioAssetDefinition): AssetTemplate {
  return template({
    id: def.id,
    name: def.name,
    category: def.category,
    collection: def.collection,
    tags: def.tags ?? [],
    renderer: def.renderer ?? 'dom',
    description: def.description,
    thumbnail: def.thumbnail,
    defaultLayer: {
      placement: {
        fit: def.fit ?? defaultFit(def.category),
        x: def.x ?? 0,
        y: def.y ?? 0,
        scale: def.scale ?? defaultScale(def.category),
        rotation: def.rotation ?? 0,
        opacity: def.opacity ?? defaultOpacity(def.category),
        anchor: 'center',
      },
      reaction: {
        trigger: def.trigger ?? defaultTrigger(def.category),
        pulseAmount: def.pulseAmount ?? defaultPulse(def.category),
        extraEffect: def.extraEffect ?? defaultExtra(def.category),
        extraAmount: def.extraAmount ?? defaultExtraAmount(def.category),
        smoothness: def.smoothness ?? 0.24,
      },
      settings: def.settings ?? {},
    },
    controls: controlsFor(def.category, def.settings ?? {}),
  })
}

function defaultFit(category: AssetCategory): FitMode {
  if (category === 'puppets') return 'cover'
  if (category === 'images-cutouts' || category === 'typography' || category === 'shapes' || category === 'three-objects') return 'contain'
  if (category === 'frames') return 'stretch'
  return 'cover'
}

function defaultScale(category: AssetCategory): number {
  if (category === 'images-cutouts') return 0.72
  if (category === 'typography') return 0.82
  if (category === 'three-objects') return 0.72
  if (category === 'puppets') return 0.85
  return 1
}

function defaultOpacity(category: AssetCategory): number {
  if (category === 'textures') return 0.22
  if (category === 'frames') return 0.86
  if (category === 'motion-effects') return 0.55
  return 1
}

function defaultTrigger(category: AssetCategory): AudioTrigger {
  switch (category) {
    case 'gradients': return 'bass'
    case 'particles': return 'highs'
    case 'frames': return 'full'
    case 'typography': return 'vocals'
    case 'audio-visualizers': return 'full'
    case 'three-objects': return 'bass'
    case 'motion-effects': return 'beat'
    case 'textures': return 'highs'
    case 'puppets': return 'beat'
    default: return 'vocals'
  }
}

function defaultPulse(category: AssetCategory): number {
  switch (category) {
    case 'particles': return 0.22
    case 'typography': return 0.18
    case 'audio-visualizers': return 0.14
    case 'three-objects': return 0.28
    case 'motion-effects': return 0.2
    case 'textures': return 0.03
    case 'frames': return 0.08
    case 'gradients': return 0.12
    case 'puppets': return 0.12
    default: return 0.24
  }
}

function defaultExtra(category: AssetCategory): ExtraEffect {
  switch (category) {
    case 'gradients': return 'drift'
    case 'particles': return 'glow'
    case 'typography': return 'float'
    case 'puppets': return 'float'
    case 'three-objects': return 'rotate'
    case 'motion-effects': return 'flicker'
    case 'textures': return 'flicker'
    default: return 'none'
  }
}

function defaultExtraAmount(category: AssetCategory): number {
  switch (category) {
    case 'particles': return 0.55
    case 'three-objects': return 0.24
    case 'motion-effects': return 0.48
    case 'gradients': return 0.24
    case 'typography': return 0.14
    case 'puppets': return 0.16
    default: return 0.2
  }
}

function controlsFor(category: AssetCategory, settings: Record<string, unknown>): AssetTemplate['controls'] {
  const controls: AssetTemplate['controls'] = []
  for (const key of ['color', 'colorA', 'colorB', 'colorC']) {
    if (key in settings) controls.push({ key, label: labelFromKey(key), type: 'color' })
  }
  if ('text' in settings) controls.push({ key: 'text', label: 'Text', type: 'text' })
  if (category === 'particles') controls.push({ key: 'density', label: 'Density', type: 'slider', min: 12, max: 96, step: 1 })
  if (category === 'audio-visualizers') controls.push({ key: 'bars', label: 'Bars', type: 'slider', min: 12, max: 96, step: 1 })
  if (category === 'puppets') {
    controls.push({ key: 'danceId', label: 'Dance', type: 'select', options: listDances().map((d) => d.id) })
    controls.push({ key: 'outfitId', label: 'Outfit', type: 'select', options: listOutfits().map((o) => o.id) })
    controls.push({ key: 'autoDance', label: 'Auto Dance', type: 'select', options: ['false', 'true'] })
    controls.push({ key: 'showStage', label: 'Stage Glow', type: 'select', options: ['true', 'false'] })
  }
  if (category === 'subtitles') {
    controls.push({ key: 'subtitleStyle', label: 'Style', type: 'select', options: ['cinematic', 'pop', 'karaoke', 'retro', 'minimal'] })
    controls.push({ key: 'fontSize', label: 'Size', type: 'slider', min: 20, max: 120, step: 2 })
  }
  return controls
}

function labelFromKey(key: string) {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())
}

// ─── Backgrounds ─────────────────────────────────────────────────────────────

const backgrounds: StudioAssetDefinition[] = [
  {
    id: 'liquid-gradient',
    name: 'Liquid Neon',
    thumbnail: 'LN',
    category: 'gradients',
    collection: 'backgrounds',
    description: 'Fluid neon color blend — versatile stage foundation for any genre.',
    tags: ['gradient', 'neon', 'club'],
    extraEffect: 'drift',
    settings: { visualKind: 'gradient', colorA: '#5b4bff', colorB: '#ff4fd8', colorC: '#00e0ff' },
  },
  {
    id: 'warehouse-lights',
    name: 'Club Wash',
    thumbnail: 'CW',
    category: 'gradients',
    collection: 'backgrounds',
    description: 'Dark club sweep with purple and cyan energy — built for DJ sets.',
    tags: ['gradient', 'club', 'dark'],
    extraEffect: 'drift',
    settings: { visualKind: 'gradient', colorA: '#0b1021', colorB: '#6f2cff', colorC: '#00eaff' },
  },
  {
    id: 'midnight-heat',
    name: 'Midnight Heat',
    thumbnail: 'MH',
    category: 'gradients',
    collection: 'backgrounds',
    description: 'Dark and aggressive warm gradient — high contrast for rap and trap.',
    tags: ['gradient', 'dark', 'trap'],
    extraEffect: 'drift',
    settings: { visualKind: 'gradient', colorA: '#111111', colorB: '#7f1d1d', colorC: '#ff6b00' },
  },
  {
    id: 'vhs-noise',
    name: 'VHS Scanlines',
    thumbnail: 'VH',
    category: 'textures',
    collection: 'backgrounds',
    description: 'Classic tape scanline overlay — adds lo-fi analog depth to any scene.',
    tags: ['texture', 'vhs', 'analog'],
    opacity: 0.22,
    trigger: 'highs',
    pulseAmount: 0.02,
    extraEffect: 'flicker',
    extraAmount: 0.36,
    settings: { visualKind: 'texture', textureKind: 'scanlines', color: '#ffffff' },
  },
  {
    id: 'paper-grain',
    name: 'Paper Grain',
    thumbnail: 'PG',
    category: 'textures',
    collection: 'backgrounds',
    description: 'Soft print texture — elevates editorial and album art motion.',
    tags: ['texture', 'paper', 'editorial'],
    opacity: 0.18,
    settings: { visualKind: 'texture', textureKind: 'paper', color: '#ffffff' },
  },
  {
    id: 'halftone-crush',
    name: 'Halftone',
    thumbnail: 'HT',
    category: 'textures',
    collection: 'backgrounds',
    description: 'Gritty poster halftone overlay — essential for trap, punk, and zine aesthetics.',
    tags: ['texture', 'halftone', 'grit'],
    opacity: 0.24,
    trigger: 'beat',
    extraEffect: 'flicker',
    extraAmount: 0.28,
    settings: { visualKind: 'texture', textureKind: 'halftone', color: '#ffffff' },
  },
]

// ─── Visualizers ──────────────────────────────────────────────────────────────

const visualizers: StudioAssetDefinition[] = [
  {
    id: 'frequency-bars',
    name: 'Frequency Bars',
    thumbnail: 'FB',
    category: 'audio-visualizers',
    collection: 'visualizers',
    description: 'Classic full-spectrum equalizer bars — the definitive audio visualizer.',
    tags: ['bars', 'equalizer', 'spectrum'],
    trigger: 'full',
    pulseAmount: 0.12,
    extraEffect: 'glow',
    extraAmount: 0.24,
    settings: { visualKind: 'audioVisualizer', visualizerKind: 'bars', color: '#f2f0ff', bars: 64 },
  },
  {
    id: 'radial-spectrum',
    name: 'Radial Spectrum',
    thumbnail: 'RS',
    category: 'audio-visualizers',
    collection: 'visualizers',
    description: 'Circular spectrum burst — frequencies radiate outward from center.',
    tags: ['radial', 'spectrum', 'circular'],
    trigger: 'full',
    pulseAmount: 0.14,
    extraEffect: 'glow',
    extraAmount: 0.3,
    settings: { visualKind: 'audioVisualizer', visualizerKind: 'radial', color: '#80ffdb', bars: 54 },
  },
  {
    id: 'bass-rings',
    name: 'Bass Rings',
    thumbnail: 'BR',
    category: 'audio-visualizers',
    collection: 'visualizers',
    description: 'Concentric ring pulses that respond to kick and bass energy.',
    tags: ['rings', 'bass', 'kick'],
    trigger: 'bass',
    pulseAmount: 0.32,
    extraEffect: 'glow',
    extraAmount: 0.36,
    settings: { visualKind: 'audioVisualizer', visualizerKind: 'rings', color: '#ffffff', bars: 36 },
  },
  {
    id: 'wave-ribbon',
    name: 'Wave Ribbon',
    thumbnail: 'WR',
    category: 'audio-visualizers',
    collection: 'visualizers',
    description: 'Fluid ribbon waveform — smooth and expressive for melodic content.',
    tags: ['ribbon', 'wave', 'fluid'],
    trigger: 'full',
    pulseAmount: 0.1,
    extraEffect: 'glow',
    extraAmount: 0.2,
    settings: { visualKind: 'audioVisualizer', visualizerKind: 'ribbon', color: '#ff4fd8', bars: 40 },
  },
  {
    id: 'oscilloscope-line',
    name: 'Oscilloscope',
    thumbnail: 'OS',
    category: 'audio-visualizers',
    collection: 'visualizers',
    description: 'Classic oscilloscope line — raw waveform with a technical feel.',
    tags: ['scope', 'waveform', 'technical'],
    trigger: 'full',
    pulseAmount: 0.08,
    extraEffect: 'glow',
    extraAmount: 0.18,
    settings: { visualKind: 'audioVisualizer', visualizerKind: 'scope', color: '#39ff14', bars: 44 },
  },
  {
    id: 'kick-halo',
    name: 'Kick Halo',
    thumbnail: 'KH',
    category: 'audio-visualizers',
    collection: 'visualizers',
    description: 'Ambient halo rings that pulse with kick drum energy.',
    tags: ['halo', 'kick', 'ambient'],
    trigger: 'bass',
    pulseAmount: 0.42,
    extraEffect: 'glow',
    extraAmount: 0.44,
    settings: { visualKind: 'audioVisualizer', visualizerKind: 'halo', color: '#ffffff', bars: 24 },
  },
]

// ─── Particles ────────────────────────────────────────────────────────────────

const particles: StudioAssetDefinition[] = [
  {
    id: 'ember-dust',
    name: 'Ember Dust',
    thumbnail: 'ED',
    category: 'particles',
    collection: 'particles',
    description: 'Floating ember field — warm fire energy for drops and build-ups.',
    tags: ['embers', 'fire', 'warm'],
    trigger: 'highs',
    pulseAmount: 0.2,
    extraEffect: 'glow',
    extraAmount: 0.58,
    settings: { visualKind: 'particles', particleKind: 'embers', color: '#ff9f1c', density: 44 },
  },
  {
    id: 'dream-bubbles',
    name: 'Dream Bubbles',
    thumbnail: 'DB',
    category: 'particles',
    collection: 'particles',
    description: 'Soft drifting bubbles — dreamy and calm for ambient and R&B tracks.',
    tags: ['bubbles', 'dreamy', 'soft'],
    trigger: 'full',
    pulseAmount: 0.12,
    extraEffect: 'float',
    extraAmount: 0.42,
    settings: { visualKind: 'particles', particleKind: 'bubbles', color: '#c4b5fd', density: 38 },
  },
  {
    id: 'mirrorball-sparkles',
    name: 'Mirrorball Sparkles',
    thumbnail: 'MS',
    category: 'particles',
    collection: 'particles',
    description: 'Dense glitter cloud from a spinning disco ball — pure dancefloor shimmer.',
    tags: ['glitter', 'disco', 'sparkle'],
    trigger: 'highs',
    pulseAmount: 0.22,
    extraEffect: 'glow',
    extraAmount: 0.62,
    settings: { visualKind: 'particles', particleKind: 'glitter', color: '#f6f7ff', density: 56 },
  },
  {
    id: 'club-laser-dust',
    name: 'Laser Dust',
    thumbnail: 'LD',
    category: 'particles',
    collection: 'particles',
    description: 'Needle-thin laser particles that streak through the frame like a live show.',
    tags: ['laser', 'club', 'dancefloor'],
    trigger: 'highs',
    pulseAmount: 0.26,
    extraEffect: 'glow',
    extraAmount: 0.7,
    settings: { visualKind: 'particles', particleKind: 'laser', color: '#66f2ff', density: 48 },
  },
  {
    id: 'rune-shards',
    name: 'Crystal Shards',
    thumbnail: 'CS',
    category: 'particles',
    collection: 'particles',
    description: 'Falling geometric shards — dramatic and cinematic for dark or esoteric edits.',
    tags: ['shards', 'crystal', 'cinematic'],
    trigger: 'beat',
    pulseAmount: 0.24,
    extraEffect: 'glow',
    extraAmount: 0.5,
    settings: { visualKind: 'particles', particleKind: 'shards', color: '#f4c95d', density: 40 },
  },
  {
    id: 'heart-sparks',
    name: 'Heart Sparks',
    thumbnail: 'HS',
    category: 'particles',
    collection: 'particles',
    description: 'Playful heart-shaped sparks — pop energy for R&B, love tracks, and social clips.',
    tags: ['hearts', 'pop', 'playful'],
    trigger: 'highs',
    pulseAmount: 0.22,
    extraEffect: 'float',
    extraAmount: 0.44,
    settings: { visualKind: 'particles', particleKind: 'hearts', color: '#ff5c8a', density: 34 },
  },
]

// ─── Objects ─────────────────────────────────────────────────────────────────

const objects: StudioAssetDefinition[] = [
  {
    id: 'chrome-orb',
    name: 'Chrome Orb',
    thumbnail: 'CO',
    category: 'three-objects',
    collection: 'objects',
    description: 'Polished chrome sphere — luxury centerpiece for trap, R&B, and editorial.',
    tags: ['orb', 'chrome', 'sphere'],
    trigger: 'bass',
    pulseAmount: 0.28,
    extraEffect: 'rotate',
    extraAmount: 0.22,
    settings: { visualKind: 'threeObject', objectKind: 'orb', color: '#d7e1ff' },
  },
  {
    id: 'floating-gem',
    name: 'Crystal Gem',
    thumbnail: 'GE',
    category: 'three-objects',
    collection: 'objects',
    description: 'Floating faceted crystal — catches light and rotates with bass energy.',
    tags: ['gem', 'crystal', 'faceted'],
    trigger: 'bass',
    pulseAmount: 0.34,
    extraEffect: 'rotate',
    extraAmount: 0.28,
    settings: { visualKind: 'threeObject', objectKind: 'gem', color: '#ff4fd8' },
  },
  {
    id: 'floating-record',
    name: 'Vinyl Record',
    thumbnail: 'VR',
    category: 'three-objects',
    collection: 'objects',
    description: 'Spinning vinyl disc — essential music visual, pairs with any genre.',
    tags: ['vinyl', 'record', 'music'],
    trigger: 'beat',
    pulseAmount: 0.22,
    extraEffect: 'rotate',
    extraAmount: 0.32,
    settings: { visualKind: 'threeObject', objectKind: 'record', color: '#111111' },
  },
  {
    id: 'glass-cube',
    name: 'Glass Cube',
    thumbnail: 'GC',
    category: 'three-objects',
    collection: 'objects',
    description: 'Translucent glass cube — geometric and minimal, great for electronic music.',
    tags: ['cube', 'glass', 'geometric'],
    trigger: 'beat',
    pulseAmount: 0.26,
    extraEffect: 'rotate',
    extraAmount: 0.2,
    settings: { visualKind: 'threeObject', objectKind: 'cube', color: '#9bf6ff' },
  },
  {
    id: 'disco-ball',
    name: 'Disco Ball',
    thumbnail: 'DB',
    category: 'three-objects',
    collection: 'objects',
    description: 'Reflective mirrorball — iconic dance floor centerpiece.',
    tags: ['disco', 'mirrorball', 'dance'],
    trigger: 'beat',
    pulseAmount: 0.2,
    extraEffect: 'rotate',
    extraAmount: 0.38,
    settings: { visualKind: 'threeObject', objectKind: 'disco-ball', color: '#f7f8ff' },
  },
  {
    id: 'neon-tunnel',
    name: 'Neon Tunnel',
    thumbnail: 'NT',
    category: 'three-objects',
    collection: 'objects',
    description: 'Depth-heavy neon tunnel — immersive backdrop for club and rave content.',
    tags: ['tunnel', 'depth', 'neon'],
    trigger: 'bass',
    pulseAmount: 0.18,
    extraEffect: 'drift',
    extraAmount: 0.22,
    settings: { visualKind: 'threeObject', objectKind: 'tunnel', color: '#00e0ff' },
  },
]

// ─── Type & Frames ────────────────────────────────────────────────────────────

const typeAndFrames: StudioAssetDefinition[] = [
  {
    id: 'kinetic-title',
    name: 'Kinetic Title',
    thumbnail: 'KT',
    category: 'typography',
    collection: 'type-frames',
    description: 'Giant bold headline that pulses with the music — instantly readable on any stage.',
    tags: ['title', 'headline', 'bold'],
    trigger: 'vocals',
    pulseAmount: 0.2,
    extraEffect: 'float',
    extraAmount: 0.14,
    settings: { visualKind: 'typography', typeKind: 'block', text: 'AUDIO VISUAL', color: '#ffffff' },
  },
  {
    id: 'neon-sign',
    name: 'Neon Sign',
    thumbnail: 'NS',
    category: 'typography',
    collection: 'type-frames',
    description: 'Glowing neon sign treatment — club promo, bar signage, late-night vibes.',
    tags: ['neon', 'sign', 'glow'],
    trigger: 'vocals',
    pulseAmount: 0.22,
    extraEffect: 'glow',
    extraAmount: 0.38,
    settings: { visualKind: 'typography', typeKind: 'neon', text: 'MIDNIGHT', color: '#80ffdb' },
  },
  {
    id: 'lyric-card',
    name: 'Lyric Card',
    thumbnail: 'LC',
    category: 'typography',
    collection: 'type-frames',
    description: 'Centered lyric or caption block — clean and readable for quotes and subtitles.',
    tags: ['lyric', 'caption', 'subtitle'],
    trigger: 'vocals',
    pulseAmount: 0.14,
    extraEffect: 'float',
    extraAmount: 0.12,
    settings: { visualKind: 'typography', typeKind: 'lyric', text: 'one line at a time', color: '#ffffff' },
  },
  {
    id: 'vhs-border',
    name: 'VHS Border',
    thumbnail: 'VB',
    category: 'frames',
    collection: 'type-frames',
    description: 'Camcorder border marks — lo-fi frame that sells the analog look.',
    tags: ['vhs', 'border', 'camcorder'],
    fit: 'stretch',
    opacity: 0.88,
    trigger: 'full',
    pulseAmount: 0.05,
    extraEffect: 'glow',
    extraAmount: 0.12,
    settings: { visualKind: 'frame', frameKind: 'vhs', color: '#ffffff' },
  },
  {
    id: 'film-strip',
    name: 'Film Strip',
    thumbnail: 'FS',
    category: 'frames',
    collection: 'type-frames',
    description: 'Film strip edge frame — cinematic composition for music videos and album art.',
    tags: ['film', 'strip', 'cinematic'],
    fit: 'stretch',
    opacity: 0.9,
    trigger: 'full',
    pulseAmount: 0.04,
    settings: { visualKind: 'frame', frameKind: 'filmstrip', color: '#111111' },
  },
  {
    id: 'polaroid-frame',
    name: 'Polaroid',
    thumbnail: 'PF',
    category: 'frames',
    collection: 'type-frames',
    description: 'Instant-photo frame — classic and nostalgic for indie, folk, and editorial.',
    tags: ['polaroid', 'photo', 'nostalgic'],
    fit: 'stretch',
    opacity: 0.92,
    trigger: 'full',
    pulseAmount: 0.04,
    settings: { visualKind: 'frame', frameKind: 'polaroid', color: '#fff8ea' },
  },
]

// ─── FX Overlays ──────────────────────────────────────────────────────────────

const fxOverlays: StudioAssetDefinition[] = [
  {
    id: 'glitch-blocks',
    name: 'Glitch',
    thumbnail: 'GL',
    category: 'motion-effects',
    collection: 'fx-overlays',
    description: 'Blocky digital glitch overlay — reactive to beats, adds raw energy.',
    tags: ['glitch', 'digital', 'distortion'],
    opacity: 0.55,
    trigger: 'beat',
    pulseAmount: 0.22,
    extraEffect: 'flicker',
    extraAmount: 0.52,
    settings: { visualKind: 'motionEffect', effectKind: 'glitch', color: '#ffffff' },
  },
  {
    id: 'rgb-split',
    name: 'RGB Split',
    thumbnail: 'RG',
    category: 'motion-effects',
    collection: 'fx-overlays',
    description: 'Prismatic RGB channel split — adds chromatic aberration on drops.',
    tags: ['rgb', 'prism', 'chromatic'],
    opacity: 0.48,
    trigger: 'beat',
    pulseAmount: 0.28,
    extraEffect: 'flicker',
    extraAmount: 0.44,
    settings: { visualKind: 'motionEffect', effectKind: 'rgb', color: '#ffffff' },
  },
  {
    id: 'strobe-flash',
    name: 'Strobe Flash',
    thumbnail: 'SF',
    category: 'motion-effects',
    collection: 'fx-overlays',
    description: 'Beat-driven white flash wash — classic strobe for hard drops and peaks.',
    tags: ['strobe', 'flash', 'drop'],
    opacity: 0.4,
    trigger: 'beat',
    pulseAmount: 0.5,
    extraEffect: 'flicker',
    extraAmount: 0.6,
    settings: { visualKind: 'motionEffect', effectKind: 'strobe', color: '#ffffff' },
  },
  {
    id: 'blur-bloom',
    name: 'Blur Bloom',
    thumbnail: 'BB',
    category: 'motion-effects',
    collection: 'fx-overlays',
    description: 'Soft bloom wash that adds warmth and depth — cinematic glow effect.',
    tags: ['bloom', 'blur', 'glow'],
    opacity: 0.44,
    trigger: 'full',
    pulseAmount: 0.18,
    extraEffect: 'flicker',
    extraAmount: 0.3,
    settings: { visualKind: 'motionEffect', effectKind: 'bloom', color: '#ff4fd8' },
  },
  {
    id: 'zoom-lines',
    name: 'Zoom Lines',
    thumbnail: 'ZL',
    category: 'motion-effects',
    collection: 'fx-overlays',
    description: 'Radial impact zoom lines — kinetic energy for drops and hard punches.',
    tags: ['zoom', 'impact', 'radial'],
    opacity: 0.5,
    trigger: 'beat',
    pulseAmount: 0.32,
    extraEffect: 'flicker',
    extraAmount: 0.48,
    settings: { visualKind: 'motionEffect', effectKind: 'zoom-lines', color: '#ffffff' },
  },
  {
    id: 'analog-roll',
    name: 'Analog Roll',
    thumbnail: 'AR',
    category: 'motion-effects',
    collection: 'fx-overlays',
    description: 'Vertical analog roll band — tape machine instability for VHS and lo-fi aesthetics.',
    tags: ['analog', 'roll', 'vhs'],
    opacity: 0.5,
    trigger: 'beat',
    pulseAmount: 0.16,
    extraEffect: 'flicker',
    extraAmount: 0.38,
    settings: { visualKind: 'motionEffect', effectKind: 'roll', color: '#ffffff' },
  },
]

// ─── Utility ─────────────────────────────────────────────────────────────────

const utility: StudioAssetDefinition[] = [
  {
    id: 'video-layer',
    name: 'Video Layer',
    thumbnail: '▶',
    category: 'images-cutouts',
    collection: 'uploads',
    description: 'Upload and place a video file as a stage layer.',
    tags: ['upload', 'video', 'media'],
    fit: 'contain',
    scale: 0.82,
    trigger: 'full',
    pulseAmount: 0.1,
    extraEffect: 'none',
    settings: { visualKind: 'video', cutoutKind: 'video', color: '#ffffff' },
  },
  {
    id: 'photo-cutout',
    name: 'Photo Cutout',
    thumbnail: 'IMG',
    category: 'images-cutouts',
    collection: 'uploads',
    description: 'Upload and place any image as an editable layer on the stage.',
    tags: ['upload', 'photo', 'image'],
    fit: 'contain',
    scale: 0.72,
    trigger: 'vocals',
    pulseAmount: 0.24,
    extraEffect: 'float',
    extraAmount: 0.18,
    settings: { visualKind: 'cutout', cutoutKind: 'upload', color: '#ffffff' },
  },
]

// ─── Puppets ─────────────────────────────────────────────────────────────────

const puppets: StudioAssetDefinition[] = [
  {
    id: 'puppet-dancer',
    name: 'Club Dancer',
    thumbnail: 'CD',
    category: 'puppets',
    collection: 'puppets',
    renderer: 'canvas',
    description: 'Neon raver face, club tee — shuffle and arm-wave grooves.',
    tags: ['puppet', 'dancer', 'club', 'neon'],
    fit: 'cover',
    scale: 1,
    trigger: 'beat',
    pulseAmount: 0.12,
    extraEffect: 'float',
    extraAmount: 0.16,
    settings: {
      visualKind: 'puppet',
      characterId: 'char-club',
      puppetId: 'human-default',
      danceId: 'shuffle',
      skinId: 'skinClub',
      outfitId: 'club-tee',
      faceKitId: 'neon-raver',
      autoDance: true,
      showStage: true,
      triggerPreset: 'vivid',
    },
  },
  {
    id: 'puppet-street',
    name: 'Street Dancer',
    thumbnail: 'ST',
    category: 'puppets',
    collection: 'puppets',
    renderer: 'canvas',
    description: 'Chill street face, oversized hoodie — loose goofy grooves.',
    tags: ['puppet', 'street', 'hoodie', 'chill'],
    fit: 'cover',
    scale: 1,
    trigger: 'beat',
    pulseAmount: 0.1,
    extraEffect: 'drift',
    extraAmount: 0.14,
    settings: {
      visualKind: 'puppet',
      characterId: 'char-street',
      puppetId: 'human-default',
      danceId: 'goofyTwoStep',
      skinId: 'skinStreet',
      outfitId: 'street-hoodie',
      faceKitId: 'street-chill',
      autoDance: true,
      showStage: true,
      triggerPreset: 'vivid',
    },
  },
  {
    id: 'puppet-stage',
    name: 'Stage Dancer',
    thumbnail: 'SG',
    category: 'puppets',
    collection: 'puppets',
    renderer: 'canvas',
    description: 'Electric stage face, sparkle fit — arm waves and kick grooves.',
    tags: ['puppet', 'stage', 'sparkle', 'energy'],
    fit: 'cover',
    scale: 1,
    trigger: 'bass',
    pulseAmount: 0.18,
    extraEffect: 'shake',
    extraAmount: 0.14,
    settings: {
      visualKind: 'puppet',
      characterId: 'char-stage',
      puppetId: 'human-default',
      danceId: 'armWave',
      skinId: 'skinStage',
      outfitId: 'stage-sparkle',
      faceKitId: 'stage-electric',
      autoDance: true,
      showStage: true,
      triggerPreset: 'chaos',
    },
  },
  {
    id: 'puppet-evening',
    name: 'Evening Dancer',
    thumbnail: 'EV',
    category: 'puppets',
    collection: 'puppets',
    renderer: 'canvas',
    description: 'Glam evening face, fitted dress — lean-back slow grooves.',
    tags: ['puppet', 'evening', 'fancy', 'dress'],
    fit: 'cover',
    scale: 1,
    trigger: 'vocals',
    pulseAmount: 0.14,
    extraEffect: 'float',
    extraAmount: 0.12,
    settings: {
      visualKind: 'puppet',
      characterId: 'char-evening',
      puppetId: 'human-default',
      danceId: 'leanGroove',
      skinId: 'skinEvening',
      outfitId: 'evening-dress',
      faceKitId: 'evening-glam',
      autoDance: true,
      showStage: true,
      triggerPreset: 'tame',
    },
  },
  {
    id: 'puppet-blazer',
    name: 'Blazer Dancer',
    thumbnail: 'BZ',
    category: 'puppets',
    collection: 'puppets',
    renderer: 'canvas',
    description: 'Sharp classic face, slim blazer — tight robot and shuffle.',
    tags: ['puppet', 'blazer', 'fancy', 'suit'],
    fit: 'cover',
    scale: 1,
    trigger: 'beat',
    pulseAmount: 0.1,
    extraEffect: 'none',
    extraAmount: 0.1,
    settings: {
      visualKind: 'puppet',
      characterId: 'char-blazer',
      puppetId: 'human-default',
      danceId: 'robot',
      skinId: 'skinBlazer',
      outfitId: 'slim-blazer',
      faceKitId: 'sharp-classic',
      autoDance: true,
      showStage: false,
      triggerPreset: 'tame',
    },
  },
  {
    id: 'puppet-robot',
    name: 'Robot Dancer',
    thumbnail: 'RB',
    category: 'puppets',
    collection: 'puppets',
    renderer: 'canvas',
    description: 'Chrome panel face, bare metal rig — mechanical snap moves.',
    tags: ['puppet', 'robot', 'mechanical'],
    fit: 'cover',
    scale: 1,
    trigger: 'beat',
    pulseAmount: 0.08,
    extraEffect: 'none',
    settings: {
      visualKind: 'puppet',
      characterId: 'char-robot',
      puppetId: 'human-default',
      danceId: 'mechanical',
      skinId: 'skinRobot',
      outfitId: 'none',
      faceKitId: 'robot-chrome',
      autoDance: true,
      showStage: false,
      triggerPreset: 'tame',
    },
  },
]

// ─── Subtitles ────────────────────────────────────────────────────────────────

const subtitles: StudioAssetDefinition[] = [
  {
    id: 'subtitle-layer',
    name: 'Subtitles',
    thumbnail: 'SRT',
    category: 'subtitles',
    collection: 'transcript',
    renderer: 'dom',
    description: 'Timed subtitle cues from an .srt file or manual input.',
    tags: ['subtitle', 'caption', 'lyrics', 'srt'],
    fit: 'stretch',
    scale: 1,
    x: 0,
    y: 0,
    opacity: 1,
    trigger: 'none',
    pulseAmount: 0,
    extraEffect: 'none',
    extraAmount: 0,
    smoothness: 0,
    settings: {
      visualKind: 'subtitle',
      subtitleStyle: 'cinematic',
      color: '#ffffff',
      fontSize: 48,
      subtitleOffsetY: 10,
      cues: [],
    },
  },
]

// ─── Registry ─────────────────────────────────────────────────────────────────

const allAssets: StudioAssetDefinition[] = [
  ...backgrounds,
  ...visualizers,
  ...particles,
  ...objects,
  ...typeAndFrames,
  ...fxOverlays,
  ...puppets,
  ...utility,
  ...subtitles,
]

export const communityAssets: AssetTemplate[] = allAssets.map(studioAsset)
export const assetRegistry = new Map(communityAssets.map((asset) => [asset.id, asset]))

export function getAssetsByCategory(category: AssetCategory) {
  return communityAssets.filter((asset) => asset.category === category)
}

export function getAssetCountByCategory(category: AssetCategory) {
  return getAssetsByCategory(category).length
}
