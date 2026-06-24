export type TranscribeProvider = 'whisper' | 'audioshake'

export type TranscribeResult = {
  rawSrt: string
  provider: TranscribeProvider
}

const WHISPER_MAX_PROMPT_CHARS = 224

export class AiTranscribeService {
  async transcribe(
    audioBuffer: Buffer,
    filename: string,
    mimeType: string,
    provider: TranscribeProvider,
    lyrics?: string,
  ): Promise<TranscribeResult> {
    if (provider === 'audioshake') {
      throw Object.assign(new Error('AudioShake integration is not yet configured.'), { statusCode: 501 })
    }
    return this.whisper(audioBuffer, filename, mimeType, lyrics)
  }

  private async whisper(
    audioBuffer: Buffer,
    filename: string,
    mimeType: string,
    lyrics?: string,
  ): Promise<TranscribeResult> {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw Object.assign(
        new Error('OPENAI_API_KEY is not configured on the server.'),
        { statusCode: 503 },
      )
    }

    // Native FormData + Blob available in Node 18+
    // Uint8Array.from avoids SharedArrayBuffer variance issues with Blob constructor
    const blob = new Blob([new Uint8Array(audioBuffer)], { type: mimeType || 'audio/mpeg' })
    const form = new FormData()
    form.append('file', blob, filename)
    form.append('model', 'whisper-1')
    form.append('response_format', 'srt')
    // Whisper uses the prompt to bias vocabulary — pass lyrics as a hint
    if (lyrics?.trim()) {
      form.append('prompt', lyrics.trim().slice(0, WHISPER_MAX_PROMPT_CHARS))
    }

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    })

    if (!res.ok) {
      const body = await res.text()
      throw Object.assign(
        new Error(`Whisper API error ${res.status}: ${body}`),
        { statusCode: 502 },
      )
    }

    const rawSrt = await res.text()
    return { rawSrt, provider: 'whisper' }
  }
}
