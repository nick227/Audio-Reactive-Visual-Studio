import { PuppetThumbnail } from './PuppetThumbnail'

type Props = {
  settings: Record<string, unknown>
}

export function AssetThumbnail({ settings }: Props) {
  const visualKind = String(settings.visualKind ?? '')
  const color = String(settings.color ?? '#ffffff')

  switch (visualKind) {
    case 'gradient':
      return (
        <div
          className="layer-box studio-gradient thumb-asset"
          style={{
            ['--a' as string]: String(settings.colorA ?? '#5b4bff'),
            ['--b' as string]: String(settings.colorB ?? '#ff4fd8'),
            ['--c' as string]: String(settings.colorC ?? '#00e0ff'),
          }}
        />
      )
    case 'texture':
      return <div className={`layer-box studio-texture texture-${settings.textureKind ?? 'grain'} thumb-asset`} style={{ color }} />
    case 'particles': {
      const kind = String(settings.particleKind ?? 'sparkles')
      return (
        <div className={`layer-box studio-particles particles-${kind} thumb-asset`} style={{ color }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <b key={i} style={{
              left: `${(i * 37) % 100}%`,
              top: `${(i * 53) % 100}%`,
              animationDelay: `${(i % 7) * -0.3}s`,
              ['--s' as string]: `${3 + (i % 4)}px`,
            }} />
          ))}
        </div>
      )
    }
    case 'audioVisualizer': {
      const kind = String(settings.visualizerKind ?? 'bars')
      const count = (kind === 'rings' || kind === 'halo') ? 4 : kind === 'radial' ? 24 : 20
      return (
        <div className={`layer-box studio-visualizer visualizer-${kind} thumb-asset`} style={{ color }}>
          {Array.from({ length: count }).map((_, i) => (
            <i key={i} style={{
              ['--h' as string]: `${spectrumHeight(kind, i, count)}%`,
              ['--i' as string]: String(Math.round((i / count) * 360)),
            }} />
          ))}
        </div>
      )
    }
    case 'threeObject':
      return (
        <div className={`layer-box studio-object object-${settings.objectKind ?? 'orb'} thumb-asset`} style={{ color }}>
          <span /><i />
        </div>
      )
    case 'typography': {
      const typeKind = String(settings.typeKind ?? 'block')
      const text = String(settings.text ?? 'TEXT')
      return (
        <div className="thumb-asset thumb-type-outer">
          <div className={`studio-type type-${typeKind}`} style={{ color, fontSize: 18, minWidth: 0, padding: '4px 8px' }}>
            {text.split(' ').slice(0, 2).join(' ')}
          </div>
        </div>
      )
    }
    case 'frame':
      return (
        <div className={`layer-box studio-frame frame-${settings.frameKind ?? 'chrome'} thumb-asset`} style={{ color }}>
          <span />
        </div>
      )
    case 'motionEffect':
      return (
        <div className={`layer-box studio-motion motion-${settings.effectKind ?? 'glitch'} thumb-asset`} style={{ color }}>
          <span />
        </div>
      )
    case 'puppet':
      return (
        <div className="thumb-asset thumb-puppet-live">
          <PuppetThumbnail characterId={String(settings.characterId ?? 'char-dancer')} />
        </div>
      )
    default:
      return null
  }
}

function spectrumHeight(kind: string, i: number, count: number): number {
  const x = i / count
  if (kind === 'bars') {
    return Math.round(Math.max(4, 10 + 75 * Math.exp(-((x - 0.18) ** 2) / 0.05) + 35 * Math.exp(-((x - 0.58) ** 2) / 0.1) + (i % 3) * 3))
  }
  return Math.round(12 + 60 * (0.5 + 0.5 * Math.sin(x * Math.PI * 3 + 0.5)) + (i % 3) * 4)
}
