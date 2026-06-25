/** Draw an image source centered at (0,0), respecting the fit mode. */
export function drawImageFitted(
  ctx: CanvasRenderingContext2D,
  src: CanvasImageSource,
  naturalW: number,
  naturalH: number,
  boxW: number,
  boxH: number,
  fit: string,
): void {
  if (!naturalW || !naturalH) {
    ctx.drawImage(src, -boxW / 2, -boxH / 2, boxW, boxH)
    return
  }
  if (fit === 'stretch') {
    ctx.drawImage(src, -boxW / 2, -boxH / 2, boxW, boxH)
    return
  }
  if (fit === 'cover') {
    const scale = Math.max(boxW / naturalW, boxH / naturalH)
    const dw = naturalW * scale, dh = naturalH * scale
    ctx.drawImage(src, -dw / 2, -dh / 2, dw, dh)
    return
  }
  // contain (default)
  const scale = Math.min(boxW / naturalW, boxH / naturalH)
  const dw = naturalW * scale, dh = naturalH * scale
  ctx.drawImage(src, -dw / 2, -dh / 2, dw, dh)
}

/** Compute the drawing box size in canvas pixels for a layer, based on its fit mode. */
export function layerBoxPx(
  fit: string,
  canvasW: number,
  canvasH: number,
): { w: number; h: number } {
  if (fit === 'cover' || fit === 'stretch') return { w: canvasW, h: canvasH }
  return { w: canvasW * 0.74, h: canvasH * 0.74 }
}
