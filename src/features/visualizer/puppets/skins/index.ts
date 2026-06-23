export type PuppetSkin = {
  line: string
  joint: string
  face: string
  faceHighlight: string
  accent: string
  shadow: string
  eyeWhite: string
  pupil: string
  pupilHighlight: string
  lid: string
  lidLine: string
  brow: string
  lip: string
  tongue: string
  cheek: string
  mouthInterior: string
}

export const defaultHumanSkin: PuppetSkin = {
  line: '#f8fafc',
  joint: '#facc15',
  face: '#fde9b8',
  faceHighlight: '#fff7e8',
  accent: '#22d3ee',
  shadow: 'rgba(0,0,0,0.35)',
  eyeWhite: '#fffef8',
  pupil: '#1a1f2e',
  pupilHighlight: '#ffffff',
  lid: '#e8c99a',
  lidLine: '#c9a66b',
  brow: '#3d2e1f',
  lip: '#5c3d2e',
  tongue: '#f4728a',
  cheek: 'rgba(255,120,140,0.18)',
  mouthInterior: '#2a1520',
}

const skinRegistry = new Map<string, PuppetSkin>([
  ['defaultHuman', defaultHumanSkin],
  [
    'skinClub',
    {
      ...defaultHumanSkin,
      line: '#f0f4ff',
      joint: '#e94560',
      face: '#ffd6e0',
      faceHighlight: '#fff0f3',
      accent: '#ff2e63',
      pupil: '#1a0a14',
      cheek: 'rgba(255,46,99,0.22)',
    },
  ],
  [
    'skinStreet',
    {
      ...defaultHumanSkin,
      line: '#e2e8f0',
      joint: '#90cdf4',
      face: '#d4a574',
      faceHighlight: '#e8c9a0',
      accent: '#63b3ed',
      brow: '#2d3748',
      cheek: 'rgba(99,179,237,0.12)',
    },
  ],
  [
    'skinEvening',
    {
      ...defaultHumanSkin,
      line: '#fce7f3',
      joint: '#fbbf24',
      face: '#fecdd3',
      faceHighlight: '#fff1f2',
      accent: '#f472b6',
      pupil: '#4a044e',
      lip: '#9d174d',
      cheek: 'rgba(244,114,182,0.25)',
    },
  ],
  [
    'skinBlazer',
    {
      ...defaultHumanSkin,
      line: '#d6d3d1',
      joint: '#d4af37',
      face: '#e7e5e4',
      faceHighlight: '#fafaf9',
      accent: '#ca8a04',
      brow: '#1c1917',
      lip: '#44403c',
      cheek: 'rgba(212,175,55,0.1)',
    },
  ],
  [
    'skinStage',
    {
      ...defaultHumanSkin,
      line: '#e0e7ff',
      joint: '#818cf8',
      face: '#c4b5fd',
      faceHighlight: '#ede9fe',
      accent: '#22d3ee',
      pupil: '#312e81',
      cheek: 'rgba(34,211,238,0.2)',
    },
  ],
  [
    'skinRobot',
    {
      line: '#94a3b8',
      joint: '#64748b',
      face: '#cbd5e1',
      faceHighlight: '#e2e8f0',
      accent: '#22d3ee',
      shadow: 'rgba(0,0,0,0.5)',
      eyeWhite: '#1e293b',
      pupil: '#22d3ee',
      pupilHighlight: '#67e8f9',
      lid: '#475569',
      lidLine: '#334155',
      brow: '#475569',
      lip: '#334155',
      tongue: '#22d3ee',
      cheek: 'rgba(0,0,0,0)',
      mouthInterior: '#0f172a',
    },
  ],
])

export function getSkin(id: string): PuppetSkin {
  return skinRegistry.get(id) ?? defaultHumanSkin
}
