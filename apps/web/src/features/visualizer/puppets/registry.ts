import { humanRig } from './rig/humanRig'
import type { RigDefinition } from './rig/types'

export type PuppetDefinition = {
  id: string
  rig: RigDefinition
}

const puppets: PuppetDefinition[] = [{ id: 'human-default', rig: humanRig }]

export function getPuppet(id: string): PuppetDefinition {
  return puppets.find(p => p.id === id) ?? puppets[0]
}
