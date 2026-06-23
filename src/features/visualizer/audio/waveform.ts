export async function buildWaveformPeaks(file: File, bars = 160): Promise<number[]> {
  const buffer = await file.arrayBuffer()
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const ctx = new AudioCtx()
  const decoded = await ctx.decodeAudioData(buffer.slice(0))
  const channel = decoded.getChannelData(0)
  const block = Math.floor(channel.length / bars)
  const peaks: number[] = []

  for (let i = 0; i < bars; i++) {
    let sum = 0
    const start = i * block
    for (let j = 0; j < block; j++) sum += Math.abs(channel[start + j] ?? 0)
    peaks.push(Math.min(1, (sum / block) * 4))
  }

  await ctx.close()
  return peaks
}
