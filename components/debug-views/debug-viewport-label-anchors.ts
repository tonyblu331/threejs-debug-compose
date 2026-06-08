import type { ResolvedDebugViewLayout } from "./debug-view-layout"

export interface DebugViewportLabelRegion {
  left: number
  top: number
  width: number
}

/** Where pane tags sit — must match the scanline used for band math. */
export const LABEL_SCANLINE_TOP = 0.04
const VIEWPORT_INSET = 0.04

export function createPresentationLabelRegions(
  layout: ResolvedDebugViewLayout,
): DebugViewportLabelRegion[] | null {
  if (layout.presentation !== "diagonal" && layout.presentation !== "breakdown") {
    return null
  }

  const slope = Math.tan((layout.diagonalAngle * Math.PI) / 180)

  if (layout.presentation === "diagonal") {
    return [
      regionForBandAtScanline((top) => diagonalBandSpan(0, slope, top)),
      regionForBandAtScanline((top) => diagonalBandSpan(1, slope, top)),
    ]
  }

  return Array.from({ length: layout.slots }, (_, index) =>
    regionForBandAtScanline(
      (top) => breakdownBandSpan(index, layout.slots, slope, top),
    ),
  )
}

/** @deprecated Use createPresentationLabelRegions */
export function createPresentationLabelAnchors(
  layout: ResolvedDebugViewLayout,
): Array<{ left: number; top: number }> | null {
  const regions = createPresentationLabelRegions(layout)
  if (!regions) return null

  return regions.map((region) => ({
    left: region.left + region.width / 2,
    top: region.top,
  }))
}

function regionForBandAtScanline(
  spanAtTop: (top: number) => { xMin: number; xMax: number } | null,
): DebugViewportLabelRegion {
  const atLabelLine = spanAtTop(LABEL_SCANLINE_TOP)
  if (atLabelLine && atLabelLine.xMax > atLabelLine.xMin) {
    return toRegion(atLabelLine, LABEL_SCANLINE_TOP)
  }

  let best = toRegion({ xMin: VIEWPORT_INSET, xMax: 1 - VIEWPORT_INSET }, LABEL_SCANLINE_TOP)
  let bestScore = Number.NEGATIVE_INFINITY

  for (let step = 0; step <= 24; step++) {
    const top = 0.04 + (step / 24) * 0.28
    const span = spanAtTop(top)
    if (!span) continue

    const width = span.xMax - span.xMin
    const score = width - Math.abs(top - LABEL_SCANLINE_TOP) * 0.15
    if (score > bestScore) {
      bestScore = score
      best = toRegion(span, top)
    }
  }

  return best
}

function toRegion(span: { xMin: number; xMax: number }, top: number): DebugViewportLabelRegion {
  return {
    left: span.xMin,
    top,
    width: span.xMax - span.xMin,
  }
}

export function breakdownBandSpan(
  bandIndex: number,
  bandCount: number,
  slope: number,
  cssTop: number,
) {
  const projectedOffset = (screenUvYFromCssTop(cssTop) - 0.5) * slope
  const bandLeft = bandIndex / bandCount - projectedOffset
  const bandRight = (bandIndex + 1) / bandCount - projectedOffset
  const xMin = clamp(bandLeft, VIEWPORT_INSET, 1 - VIEWPORT_INSET)
  const xMax = clamp(bandRight, VIEWPORT_INSET, 1 - VIEWPORT_INSET)

  if (xMax <= xMin) return null

  return { xMin, xMax }
}

export function projectedAt(left: number, cssTop: number, slope: number) {
  return left + (screenUvYFromCssTop(cssTop) - 0.5) * slope
}

export function breakdownBandIndex(projected: number, bandCount: number) {
  for (let index = bandCount - 1; index >= 1; index--) {
    if (projected > index / bandCount) return index
  }
  return 0
}

function diagonalBandSpan(bandIndex: 0 | 1, slope: number, cssTop: number) {
  const projectedOffset = (screenUvYFromCssTop(cssTop) - 0.5) * slope
  const splitX = 0.5 - projectedOffset

  if (bandIndex === 0) {
    const xMax = clamp(splitX, VIEWPORT_INSET, 1 - VIEWPORT_INSET)
    if (xMax <= VIEWPORT_INSET) return null
    return { xMin: VIEWPORT_INSET, xMax }
  }

  const xMin = clamp(splitX, VIEWPORT_INSET, 1 - VIEWPORT_INSET)
  if (xMin >= 1 - VIEWPORT_INSET) return null
  return { xMin, xMax: 1 - VIEWPORT_INSET }
}

/** WebGPU `screenUV` uses y=0 at the top; CSS `top` matches that axis. */
function screenUvYFromCssTop(top: number) {
  return top
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
