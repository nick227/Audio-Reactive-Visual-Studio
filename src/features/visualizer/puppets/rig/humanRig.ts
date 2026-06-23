import type { RigDefinition } from './types'

export const humanRig: RigDefinition = {
  id: 'human-default',
  joints: [
    { id: 'root', length: 0, angle: 0, radius: 4 },
    { id: 'hips', parent: 'root', length: 11, angle: 90, radius: 6 },
    { id: 'spine', parent: 'hips', length: 24, angle: -90, radius: 4.5 },
    { id: 'chest', parent: 'spine', length: 21, angle: -90, radius: 5 },
    { id: 'neck', parent: 'chest', length: 10, angle: -90, radius: 3 },
    { id: 'head', parent: 'neck', length: 17, angle: -90, radius: 12 },
    { id: 'leftShoulder', parent: 'chest', length: 15, angle: -145, radius: 4 },
    { id: 'leftElbow', parent: 'leftShoulder', length: 27, angle: -115, radius: 3.5 },
    { id: 'leftWrist', parent: 'leftElbow', length: 23, angle: -95, radius: 3 },
    { id: 'rightShoulder', parent: 'chest', length: 15, angle: -35, radius: 4 },
    { id: 'rightElbow', parent: 'rightShoulder', length: 27, angle: -65, radius: 3.5 },
    { id: 'rightWrist', parent: 'rightElbow', length: 23, angle: -85, radius: 3 },
    { id: 'leftHip', parent: 'hips', length: 13, angle: 125, radius: 4 },
    { id: 'leftKnee', parent: 'leftHip', length: 32, angle: 95, radius: 3.5 },
    { id: 'leftAnkle', parent: 'leftKnee', length: 30, angle: 88, radius: 3 },
    { id: 'rightHip', parent: 'hips', length: 13, angle: 55, radius: 4 },
    { id: 'rightKnee', parent: 'rightHip', length: 32, angle: 85, radius: 3.5 },
    { id: 'rightAnkle', parent: 'rightKnee', length: 30, angle: 92, radius: 3 },
  ],
}
