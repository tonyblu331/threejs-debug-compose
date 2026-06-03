import { describe, expect, it } from "vitest"
import { DEFAULT_DEBUG_VIEWS } from "./debug-view-definitions"
import { createDebugViewportPlan } from "./debug-viewport-plan"
import { createDebugViewportRects } from "./debug-viewport-presenter"

describe("debug viewport presenter", () => {
  it("creates top-left ordered CSS cells and bottom-left scissor rectangles", () => {
    const plan = createDebugViewportPlan({
      views: DEFAULT_DEBUG_VIEWS,
      viewportViews: [
        { view: "beauty" },
        { view: "normal" },
        { view: "depth" },
        { view: "roughness" },
      ],
      layout: "quad",
    })

    expect(createDebugViewportRects(plan)).toEqual([
      {
        index: 0,
        css: { column: 1, row: 1 },
        scissor: { x: 0, y: 0.5, width: 0.5, height: 0.5 },
      },
      {
        index: 1,
        css: { column: 2, row: 1 },
        scissor: { x: 0.5, y: 0.5, width: 0.5, height: 0.5 },
      },
      {
        index: 2,
        css: { column: 1, row: 2 },
        scissor: { x: 0, y: 0, width: 0.5, height: 0.5 },
      },
      {
        index: 3,
        css: { column: 2, row: 2 },
        scissor: { x: 0.5, y: 0, width: 0.5, height: 0.5 },
      },
    ])
  })

  it("does not create presenter rects beyond the planned cells", () => {
    const plan = createDebugViewportPlan({
      views: DEFAULT_DEBUG_VIEWS,
      viewportViews: [{ view: "beauty" }, { view: "normal" }],
      layout: { mode: "row", slots: 4 },
    })

    expect(createDebugViewportRects(plan).map((rect) => rect.index)).toEqual([0, 1])
  })
})