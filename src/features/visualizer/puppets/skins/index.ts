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

export const stageSkin: PuppetSkin = {
  line: '#e0e7ff',
  joint: '#818cf8',
  face: '#c4b5fd',
  faceHighlight: '#ede9fe',
  accent: '#22d3ee',
  pupil: '#312e81',
  cheek: 'rgba(34,211,238,0.2)',
  shadow: defaultHumanSkin.shadow,
  eyeWhite: defaultHumanSkin.eyeWhite,
  pupilHighlight: defaultHumanSkin.pupilHighlight,
  lid: defaultHumanSkin.lid,
  lidLine: defaultHumanSkin.lidLine,
  brow: defaultHumanSkin.brow,
  lip: defaultHumanSkin.lip,
  tongue: defaultHumanSkin.tongue,
  mouthInterior: defaultHumanSkin.mouthInterior,
}

export function getSkin(_id?: string): PuppetSkin {
  return stageSkin
}
