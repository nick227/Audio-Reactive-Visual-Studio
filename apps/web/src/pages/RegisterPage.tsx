import { useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useGoogleAuth, useCurrentUser } from '@avl/sdk'
import { toast } from 'sonner'
import { AudioWaveform, Layers, Share2, Cpu } from 'lucide-react'
import { SITE_NAME } from '../brand/site'

const FEATURES = [
  {
    icon: AudioWaveform,
    title: 'Audio-reactive layers',
    body: 'Every layer responds to bass, beat, melody, or silence — in real time.',
  },
  {
    icon: Layers,
    title: 'Stack unlimited effects',
    body: 'Puppets, particles, gradients, text, and 3-D objects on one timeline.',
  },
  {
    icon: Share2,
    title: 'One-click share link',
    body: 'Publish your project and send a link — no account needed to view.',
  },
  {
    icon: Cpu,
    title: 'Runs entirely in your browser',
    body: 'Your audio never leaves your device. Export to video locally.',
  },
]

export function RegisterPage() {
  const navigate = useNavigate()
  const buttonRef = useRef<HTMLDivElement>(null)
  const googleAuth = useGoogleAuth()
  const { data: me } = useCurrentUser()

  useEffect(() => {
    if (me?.data) navigate('/')
  }, [me, navigate])

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    if (!clientId) return

    const tryInit = () => {
      if (!window.google || !buttonRef.current) return false
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async ({ credential }: { credential: string }) => {
          try {
            await googleAuth.mutateAsync(credential)
            navigate('/')
          } catch {
            toast.error('Sign-up failed. Please try again.')
          }
        },
      })
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: 'outline',
        size: 'large',
        width: buttonRef.current.offsetWidth || 300,
      })
      return true
    }

    if (tryInit()) return

    const interval = setInterval(() => { if (tryInit()) clearInterval(interval) }, 200)
    const timeout = setTimeout(() => clearInterval(interval), 10_000)
    return () => { clearInterval(interval); clearTimeout(timeout) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={styles.root}>
      {/* ── Left panel — feature showcase ── */}
      <div style={styles.left}>
        <div style={styles.leftInner}>
          {/* Drifting background blobs */}
          <div style={styles.blob1} aria-hidden />
          <div style={styles.blob2} aria-hidden />

          {/* Logo */}
          <div style={styles.logoRow}>
            <span style={styles.logoMark} aria-hidden>◈</span>
            <span style={styles.logoName}>{SITE_NAME}</span>
          </div>

          {/* Hero copy */}
          <h1 style={styles.hero}>
            Turn your music into&nbsp;a visual&nbsp;experience.
          </h1>
          <p style={styles.heroSub}>
            A browser-based studio for audio-reactive visuals. Layer effects, sync
            to your track, and share with a link.
          </p>

          {/* Feature list */}
          <ul style={styles.featureList}>
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <li key={title} style={styles.featureItem}>
                <span style={styles.featureIconWrap}>
                  <Icon size={16} strokeWidth={1.75} style={{ color: 'var(--purple-light)' }} />
                </span>
                <div>
                  <span style={styles.featureTitle}>{title}</span>
                  <span style={styles.featureBody}> — {body}</span>
                </div>
              </li>
            ))}
          </ul>

          {/* Decorative waveform bars */}
          <div style={styles.waveBars} aria-hidden>
            {Array.from({ length: 28 }, (_, i) => (
              <div
                key={i}
                style={{
                  ...styles.waveBar,
                  height: `${20 + Math.sin(i * 0.7) * 14 + Math.cos(i * 1.3) * 10}px`,
                  animationDelay: `${(i * 0.08).toFixed(2)}s`,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel — auth card ── */}
      <div style={styles.right}>
        <div style={styles.card}>
          <h2 style={styles.cardHeading}>Create your account</h2>
          <p style={styles.cardSub}>
            Free forever. Sign in with Google to save projects and share your work.
          </p>

          <div style={styles.cardDivider} />

          <div ref={buttonRef} style={styles.googleBtn} />

          {googleAuth.isPending && (
            <p style={styles.pending}>Creating account…</p>
          )}

          <p style={styles.legalNote}>
            By continuing, you agree to our terms of service. Your audio and project
            data stay private and are never shared.
          </p>

          <div style={styles.cardDivider} />

          <p style={styles.switchText}>
            Already have an account?{' '}
            <Link to="/login" style={styles.switchLink}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

const WAVE_ANIMATION = `
@keyframes wave-pulse {
  0%, 100% { opacity: .25; transform: scaleY(1); }
  50%       { opacity: .65; transform: scaleY(1.4); }
}
`

// Inject the keyframes once
if (typeof document !== 'undefined' && !document.getElementById('reg-wave-style')) {
  const s = document.createElement('style')
  s.id = 'reg-wave-style'
  s.textContent = WAVE_ANIMATION
  document.head.appendChild(s)
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    minHeight: '100dvh',
    background: 'var(--bg-base)',
    overflow: 'hidden',
  },

  // ── Left ──
  left: {
    position: 'relative',
    flex: '0 0 58%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #0d0c18 0%, #130e22 50%, #0e0c1a 100%)',
    borderRight: '1px solid var(--border-subtle)',
    overflow: 'hidden',
  },
  leftInner: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column',
    maxWidth: '520px',
    width: '100%',
    padding: '3rem 3rem 2rem',
  },
  blob1: {
    position: 'absolute',
    top: '-20%',
    left: '-10%',
    width: '70%',
    height: '70%',
    background: 'radial-gradient(ellipse at center, rgba(120,88,255,.22) 0%, transparent 65%)',
    pointerEvents: 'none',
  },
  blob2: {
    position: 'absolute',
    bottom: '-15%',
    right: '-5%',
    width: '55%',
    height: '55%',
    background: 'radial-gradient(ellipse at center, rgba(255,79,216,.12) 0%, transparent 65%)',
    pointerEvents: 'none',
  },
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '3rem',
  },
  logoMark: {
    fontSize: '1.5rem',
    color: 'var(--purple-light)',
    lineHeight: 1,
    filter: 'drop-shadow(0 0 6px var(--purple-glow))',
  },
  logoName: {
    fontSize: '1rem',
    fontWeight: 700,
    letterSpacing: '0.04em',
    color: 'var(--text-hi)',
  },
  hero: {
    margin: 0,
    fontSize: 'clamp(1.6rem, 3vw, 2.2rem)',
    fontWeight: 800,
    lineHeight: 1.2,
    color: 'var(--text-primary)',
    letterSpacing: '-0.02em',
  },
  heroSub: {
    margin: '1rem 0 0',
    fontSize: '0.95rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.6,
    maxWidth: '420px',
  },
  featureList: {
    listStyle: 'none',
    margin: '2.25rem 0 0',
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '1.125rem',
  },
  featureItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.875rem',
  },
  featureIconWrap: {
    flexShrink: 0,
    marginTop: '2px',
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--purple-dim)',
    border: '1px solid var(--purple-border)',
    borderRadius: 'var(--radius-sm)',
  },
  featureTitle: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: 'var(--text-hi)',
  },
  featureBody: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
  },
  waveBars: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '3px',
    marginTop: '3rem',
    height: '48px',
  },
  waveBar: {
    width: '3px',
    borderRadius: '2px',
    background: 'var(--purple)',
    opacity: 0.3,
    animation: 'wave-pulse 1.8s ease-in-out infinite',
    transformOrigin: 'bottom',
  },

  // ── Right ──
  right: {
    flex: '1 1 42%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem 1.5rem',
    background: 'var(--bg-deep)',
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    maxWidth: '360px',
    gap: 0,
  },
  cardHeading: {
    margin: 0,
    fontSize: '1.4rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    lineHeight: 1.2,
  },
  cardSub: {
    margin: '0.625rem 0 0',
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.55,
  },
  cardDivider: {
    height: '1px',
    background: 'var(--border-subtle)',
    margin: '1.625rem 0',
  },
  googleBtn: {
    width: '100%',
    minHeight: '44px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pending: {
    margin: '0.75rem 0 0',
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
  },
  legalNote: {
    margin: '1.25rem 0 0',
    fontSize: '0.78rem',
    color: 'var(--text-ghost)',
    lineHeight: 1.55,
  },
  switchText: {
    margin: 0,
    fontSize: '0.875rem',
    color: 'var(--text-dim)',
  },
  switchLink: {
    color: 'var(--purple-light)',
    textDecoration: 'none',
    fontWeight: 500,
  },
}
