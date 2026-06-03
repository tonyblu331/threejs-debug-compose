import { describe, expect, it } from "vitest"
import { toDebugViewportPixels } from "./debug-viewport-presenter"

describe("debug viewport presenter pixels", () => {
  it("converts normalized scissor rects into renderer viewport units", () => {
    expect(
      toDebugViewportPixels(
        { x: 0.5, y: 0.25, width: 0.25, height: 0.5 },
        { width: 800, height: 600 },
      ),
    ).toEqual({ x: 400, y: 150, width: 200, height: 300 })
  })

  it("rounds fractional pixels to stable integer bounds", () => {
    expect(
      toDebugViewportPixels(
        { x: 0.333333, y: 0, width: 0.333333, height: 1 },
        { width: 1000, height: 500 },
      ),
    ).toEqual({ x: 333, y: 0, width: 333, height: 500 })
  })
})
