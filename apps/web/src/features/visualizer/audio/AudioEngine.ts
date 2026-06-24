import { AudioFeatures, silentAudioFeatures } from './audioTypes'

export class AudioEngine {
  private ctx?: AudioContext
  private analyser?: AnalyserNode
  private source?: MediaElementAudioSourceNode
  private destNode?: MediaStreamAudioDestinationNode
  private data?: Uint8Array
  private prevBass = 0
  private features: AudioFeatures = silentAudioFeatures
  private outputConnected = false

  connect(audio: HTMLAudioElement) {
    if (this.ctx) return
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    this.ctx = new AudioCtx()
    this.analyser = this.ctx.createAnalyser()
    this.analyser.fftSize = 512
    this.analyser.smoothingTimeConstant = 0.72
    this.source = this.ctx.createMediaElementSource(audio)
    this.source.connect(this.analyser)
    this.analyser.connect(this.ctx.destination)
    this.outputConnected = true
    // Tap audio output for MediaRecorder capture
    this.destNode = this.ctx.createMediaStreamDestination()
    this.analyser.connect(this.destNode)
    this.data = new Uint8Array(this.analyser.frequencyBinCount)
  }

  setOutputMuted(muted: boolean) {
    if (!this.analyser || !this.ctx) return
    if (muted && this.outputConnected) {
      this.analyser.disconnect(this.ctx.destination)
      this.outputConnected = false
    } else if (!muted && !this.outputConnected) {
      this.analyser.connect(this.ctx.destination)
      this.outputConnected = true
    }
  }

  getAudioStream(): MediaStream | undefined {
    return this.destNode?.stream
  }

  async resume() {
    if (this.ctx?.state === 'suspended') await this.ctx.resume()
  }

  getFeatures(): AudioFeatures {
    if (!this.analyser || !this.data) return this.features
    this.analyser.getByteFrequencyData(this.data as Uint8Array<ArrayBuffer>)

    const avg = (start: number, end: number) => {
      let sum = 0
      let count = 0
      for (let i = start; i < Math.min(end, this.data!.length); i++) {
        sum += this.data![i]
        count++
      }
      return count ? sum / count / 255 : 0
    }

    const bassRaw = avg(0, 12)
    const vocalsRaw = avg(18, 72)
    const highsRaw = avg(80, 180)
    const fullRaw = avg(0, this.data.length)

    const beat = Math.max(0, bassRaw - this.prevBass) * 3.4
    this.prevBass = bassRaw * 0.72 + this.prevBass * 0.28

    const binCount = this.data.length
    const targetBins = 96
    const bins: number[] = []
    for (let b = 0; b < targetBins; b++) {
      const start = Math.floor((b / targetBins) * binCount)
      const end = Math.max(start + 1, Math.floor(((b + 1) / targetBins) * binCount))
      let sum = 0
      for (let j = start; j < end; j++) sum += this.data[j]
      bins.push(clamp((sum / (end - start) / 255) * 1.6))
    }

    this.features = {
      bass: clamp(bassRaw * 1.35),
      beat: clamp(beat),
      vocals: clamp(vocalsRaw * 1.15),
      highs: clamp(highsRaw * 1.3),
      full: clamp(fullRaw * 1.4),
      bins,
    }
    return this.features
  }

  destroy() {
    void this.ctx?.close()
    this.ctx = undefined
  }
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, value))
}
