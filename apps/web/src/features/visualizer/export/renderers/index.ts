// Side-effect module: registers all canvas layer renderers.
// Import this once (renderCanvasFrame.ts does it) before calling getRenderer().
//
// To add a new renderer:
//   1. Add the kind to ALL_VISUAL_KINDS in knownKinds.ts
//   2. Create the renderer module
//   3. Import and register it here
//   4. Run `pnpm test` — the coverage test will confirm full classification
import { registerRenderer } from './registry'
import { cutoutRenderer } from './cutout'
import { videoRenderer } from './video'
import { gradientRenderer } from './gradient'
import { shapeRenderer } from './shape'
import { typographyRenderer } from './typography'
import { subtitleRenderer } from './subtitle'
import { audioVisualizerRenderer } from './audioVisualizer'
import { particlesRenderer } from './particles'
import { textureRenderer } from './texture'
import { frameRenderer } from './frame'

registerRenderer(cutoutRenderer)
registerRenderer(videoRenderer)
registerRenderer(gradientRenderer)
registerRenderer(shapeRenderer)
registerRenderer(typographyRenderer)
registerRenderer(subtitleRenderer)
registerRenderer(audioVisualizerRenderer)
registerRenderer(particlesRenderer)
registerRenderer(textureRenderer)
registerRenderer(frameRenderer)
