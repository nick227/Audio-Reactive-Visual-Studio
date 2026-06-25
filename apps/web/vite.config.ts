import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { UserConfig } from 'vitest/config'

// Cross-Origin Isolation is required for:
//   - SharedArrayBuffer  (ffmpeg.wasm multi-threaded encoding)
//   - WebCodecs threading
//   - high-precision performance.now()
// All assets in this app are local/bundled so COEP doesn't break anything.
const isolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}

const allowedHosts = ['music-visualizer.up.railway.app']

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  } satisfies UserConfig['test'],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts,
    headers: isolationHeaders,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    strictPort: true,
    allowedHosts,
    headers: isolationHeaders,
  },
})
