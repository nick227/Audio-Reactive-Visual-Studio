import type { OutfitDefinition } from './types'

export const bareOutfit: OutfitDefinition = {
  id: 'none',
  label: 'None',
  tag: 'none',
  bodyScale: 1,
  limbScale: 1,
  palette: {
    primary: 'transparent',
    secondary: 'transparent',
    accent: 'transparent',
    trim: 'transparent',
    shoe: 'transparent',
  },
}

export const outfitRegistry = new Map<string, OutfitDefinition>([
  ['none', bareOutfit],
  [
    'street-hoodie',
    {
      id: 'street-hoodie',
      label: 'Street Hoodie',
      tag: 'casual',
      bodyScale: 1.06,
      limbScale: 1.04,
      palette: {
        primary: '#4a5568',
        secondary: '#2d3748',
        accent: '#90cdf4',
        trim: '#1a202c',
        shoe: '#f7fafc',
      },
    },
  ],
  [
    'club-tee',
    {
      id: 'club-tee',
      label: 'Club Tee',
      tag: 'casual',
      bodyScale: 1,
      limbScale: 0.98,
      palette: {
        primary: '#1a1a2e',
        secondary: '#16213e',
        accent: '#e94560',
        trim: '#0f3460',
        shoe: '#edf2f7',
      },
    },
  ],
  [
    'slim-blazer',
    {
      id: 'slim-blazer',
      label: 'Slim Blazer',
      tag: 'fancy',
      bodyScale: 0.96,
      limbScale: 0.94,
      palette: {
        primary: '#1c1917',
        secondary: '#292524',
        accent: '#d4af37',
        trim: '#44403c',
        shoe: '#0c0a09',
      },
    },
  ],
  [
    'evening-dress',
    {
      id: 'evening-dress',
      label: 'Evening Dress',
      tag: 'fancy',
      bodyScale: 1.02,
      limbScale: 1,
      palette: {
        primary: '#831843',
        secondary: '#500724',
        accent: '#fbbf24',
        trim: '#9d174d',
        shoe: '#1c1917',
      },
    },
  ],
  [
    'stage-sparkle',
    {
      id: 'stage-sparkle',
      label: 'Stage Sparkle',
      tag: 'stage',
      bodyScale: 1.04,
      limbScale: 1.02,
      palette: {
        primary: '#312e81',
        secondary: '#1e1b4b',
        accent: '#22d3ee',
        trim: '#818cf8',
        shoe: '#0f172a',
      },
    },
  ],
])

export function getOutfit(id: string): OutfitDefinition {
  return outfitRegistry.get(id) ?? bareOutfit
}

export function listOutfits(): Array<{ id: string; label: string }> {
  return [...outfitRegistry.values()]
    .filter((o) => o.id !== 'none')
    .map((o) => ({ id: o.id, label: o.label }))
}
