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

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  } satisfies UserConfig['test'],
  server: {
    port: 5173,
    strictPort: true,
    headers: isolationHeaders,
  },
  preview: {
    port: 4173,
    strictPort: true,
    headers: isolationHeaders,
  },
})
