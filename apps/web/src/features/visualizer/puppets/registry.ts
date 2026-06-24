import { humanRig } from './rig/humanRig'
import type { RigDefinition } from './rig/types'

export type PuppetDefinition = {
  id: string
  label: string
  rig: RigDefinition
  defaultSkinId: string
  thumbnail: string
  tags: string[]
}

export const puppetRegistry = new Map<string, PuppetDefinition>([
  [
    'human-default',
    {
      id: 'human-default',
      label: 'Stick Dancer',
      rig: humanRig,
      defaultSkinId: 'defaultHuman',
      thumbnail: 'PD',
      tags: ['puppet', 'dancer', 'stick'],
    },
  ],
])

export function getPuppet(id: string): PuppetDefinition {
  return puppetRegistry.get(id) ?? puppetRegistry.get('human-default')!
}
