import { describe, expect, it } from "vitest"
import { createDebugViewUniforms, updateDebugViewUniforms } from "./uniforms"

describe("debug view uniforms", () => {
  it.each([
    ["single", 0],
    ["overlay", 1],
    ["split-h", 2],
    ["split-v", 3],
    ["quad", 4],
    ["row", 5],
    ["column", 6],
    ["grid", 7],
  ] as const)("maps %s layout to shader index %i", (layout, expected) => {
    const uniforms = createDebugViewUniforms()

    updateDebugViewUniforms(uniforms, 0, layout, 4, 0.35)

    expect(uniforms.layout.value).toBe(expected)
  })

  it.each([1, 2, 3, 4])("keeps view %i selectable when the view count allows it", (activeView) => {
    const uniforms = createDebugViewUniforms()

    updateDebugViewUniforms(uniforms, activeView, "single", 5, 0.35)

    expect(uniforms.activeView.value).toBe(activeView)
  })

  it("clamps unsafe view indices and overlay opacity", () => {
    const uniforms = createDebugViewUniforms()

    updateDebugViewUniforms(uniforms, 99, "overlay", 4, 5)

    expect(uniforms.activeView.value).toBe(3)
    expect(uniforms.overlayOpacity.value).toBe(1)

    updateDebugViewUniforms(uniforms, -4, "overlay", 4, -2)

    expect(uniforms.activeView.value).toBe(0)
    expect(uniforms.overlayOpacity.value).toBe(0)
  })

  it("updates grid topology uniforms", () => {
    const uniforms = createDebugViewUniforms()

    updateDebugViewUniforms(uniforms, 0, { mode: "row", slots: 4 }, 4, 0.35)

    expect(uniforms.gridColumns.value).toBe(4)
    expect(uniforms.gridRows.value).toBe(1)

    updateDebugViewUniforms(uniforms, 0, { mode: "grid", columns: 3, rows: 2 }, 6, 0.35)

    expect(uniforms.gridColumns.value).toBe(3)
    expect(uniforms.gridRows.value).toBe(2)
  })
})
