import { useEffect, useRef } from 'react'
import { renderPuppetPreview } from '../puppets/preview/renderPreview'

type Props = {
  characterId: string
  className?: string
}

export function PuppetThumbnail({ characterId, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const rect = canvas.getBoundingClientRect()
    canvas.width = Math.round(rect.width * dpr) || 120
    canvas.height = Math.round(rect.height * dpr) || 160
    renderPuppetPreview(canvas, characterId)
  }, [characterId])

  return <canvas ref={canvasRef} className={className ?? 'puppet-thumb-canvas'} aria-hidden />
}
