export type AudioFeatures = {
  bass: number
  beat: number
  vocals: number
  highs: number
  full: number
  bins?: number[]
}

export const silentAudioFeatures: AudioFeatures = {
  bass: 0,
  beat: 0,
  vocals: 0,
  highs: 0,
  full: 0,
}
