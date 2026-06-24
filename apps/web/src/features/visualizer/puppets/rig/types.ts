export type JointId = string

export type RigJoint = {
  id: JointId
  parent?: JointId
  length: number
  angle: number
  radius: number
}

export type RigDefinition = {
  id: string
  joints: RigJoint[]
}
