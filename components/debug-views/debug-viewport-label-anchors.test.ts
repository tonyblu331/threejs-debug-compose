import { describe, expect, it } from "vitest"
import { resolveDebugViewLayout } from "./debug-view-layout"
import {
  breakdownBandIndex,
  breakdownBandSpan,
  createPresentationLabelAnchors,
  createPresentationLabelRegions,
  LABEL_SCANLINE_TOP,
  projectedAt,
} from "./debug-viewport-label-anchors"

function boundaryAt(left: number, top: number, angle: number) {
  const slope = Math.tan((angle * Math.PI) / 180)
  return left - 0.5 + (top - 0.5) * slope
}

describe("debug viewport label anchors", () => {
  it("returns null for grid presentations", () => {
    expect(createPresentationLabelRegions(resolveDebugViewLayout("quad"))).toBeNull()
  })

  it("sizes breakdown label regions to their bands on the label scanline", () => {
    const layout = resolveDebugViewLayout("breakdown", { diagonalAngle: 35 })
    const slope = Math.tan((layout.diagonalAngle * Math.PI) / 180)
    const regions = createPresentationLabelRegions(layout)

    expect(regions).toHaveLength(4)

    regions?.forEach((region, index) => {
      expect(region.top).toBeGreaterThanOrEqual(0.04)
      expect(region.top).toBeLessThanOrEqual(0.32)
      const projected = projectedAt(region.left + region.width / 2, region.top, slope)
      expect(breakdownBandIndex(projected, layout.slots)).toBe(index)
      expect(region.width).toBeGreaterThan(0)
    })
  })

  it("matches compositor band boundaries at the label scanline", () => {
    const layout = resolveDebugViewLayout("breakdown", { diagonalAngle: 13 })
    const slope = Math.tan((layout.diagonalAngle * Math.PI) / 180)
    const regions = createPresentationLabelRegions(layout)!

    for (let index = 0; index < layout.slots; index++) {
      const span = breakdownBandSpan(index, layout.slots, slope, LABEL_SCANLINE_TOP)
      expect(span).not.toBeNull()
      expect(regions[index].left).toBeCloseTo(span!.xMin, 5)
      expect(regions[index].width).toBeCloseTo(span!.xMax - span!.xMin, 5)
    }
  })

  it("aligns breakdown centers with WebGPU screenUV (y=0 at top)", () => {
    const layout = resolveDebugViewLayout("breakdown", { diagonalAngle: 13 })
    const slope = Math.tan((layout.diagonalAngle * Math.PI) / 180)
    const regions = createPresentationLabelRegions(layout)!

    regions.forEach((region, index) => {
      const center = region.left + region.width / 2
      const projected = center + (region.top - 0.5) * slope
      expect(breakdownBandIndex(projected, layout.slots)).toBe(index)
    })
  })

  it("orders breakdown regions left-to-right without overlap", () => {
    const layout = resolveDebugViewLayout("breakdown", { diagonalAngle: 13 })
    const regions = createPresentationLabelRegions(layout)!

    for (let index = 1; index < regions.length; index++) {
      expect(regions[index].left).toBeGreaterThanOrEqual(regions[index - 1].left)
    }
  })

  it("centers split-diagonal anchors inside their halves", () => {
    const layout = resolveDebugViewLayout("split-diagonal", { diagonalAngle: 35 })
    const anchors = createPresentationLabelAnchors(layout)

    expect(anchors).toHaveLength(2)
    expect(boundaryAt(anchors![0].left, anchors![0].top, layout.diagonalAngle)).toBeLessThan(0)
    expect(boundaryAt(anchors![1].left, anchors![1].top, layout.diagonalAngle)).toBeGreaterThanOrEqual(0)
  })
})
