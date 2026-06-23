import { useEffect, useRef } from 'react'
import type { LayerInstance } from '../project/types'
import { puppetRuntimeHost } from '../runtime/puppetRuntimeHost'

type Props = {
  layer: LayerInstance
}

export function PuppetCanvasLayer({ layer }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    puppetRuntimeHost.attach(layer.id, canvas, layer.settings)
    puppetRuntimeHost.updatePlacement(layer.id, layer.placement.fit)

    const host = canvas.closest<HTMLElement>('.stage-layer')
    const resize = () => puppetRuntimeHost.resizeLayer(layer.id, canvas)
    const observer = new ResizeObserver(resize)
    if (host) observer.observe(host)
    observer.observe(canvas)
    requestAnimationFrame(() => {
      resize()
      requestAnimationFrame(resize)
    })

    return () => {
      observer.disconnect()
      puppetRuntimeHost.detach(layer.id)
    }
  }, [layer.id])

  useEffect(() => {
    puppetRuntimeHost.updateSettings(layer.id, layer.settings)
  }, [layer.id, layer.settings])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    puppetRuntimeHost.updatePlacement(layer.id, layer.placement.fit)
    puppetRuntimeHost.resizeLayer(layer.id, canvas)
  }, [layer.id, layer.placement.fit])

  return (
    <div className="layer-box puppet-layer-box">
      <canvas ref={canvasRef} className="puppet-canvas-layer" aria-label={layer.name} />
    </div>
  )
}
