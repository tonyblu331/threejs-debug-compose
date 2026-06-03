import { describe, expect, it } from "vitest"
import { DEFAULT_DEBUG_VIEWS } from "./debug-view-definitions"
import { resolveDebugViewLayout } from "./debug-view-layout"
import {
  createDebugViewportLabels,
  createDebugViewportPlanLabels,
} from "./debug-viewport-labels"
import { createDebugViewportPlan } from "./debug-viewport-plan"

describe("debug viewport labels", () => {
  it("uses visible view labels for row viewports", () => {
    const layout = resolveDebugViewLayout("row", { slots: 4 })

    expect(createDebugViewportLabels(DEFAULT_DEBUG_VIEWS.slice(0, 4), layout)).toEqual([
      "Beauty",
      "Normal",
      "Depth",
      "Base Color / Albedo",
    ])
  })

  it("allows explicit viewport labels", () => {
    const layout = resolveDebugViewLayout("row", { slots: 3 })

    expect(
      createDebugViewportLabels(DEFAULT_DEBUG_VIEWS.slice(0, 3), layout, [
        "Reference",
        "Normals",
        "Distance",
      ]),
    ).toEqual(["Reference", "Normals", "Distance"])
  })

  it("supports formatter labels and labels repeated fallback cells", () => {
    const layout = resolveDebugViewLayout("grid", { columns: 3, rows: 1 })

    expect(
      createDebugViewportLabels(DEFAULT_DEBUG_VIEWS.slice(0, 2), layout, (view, index) =>
        `${index + 1}: ${view.label}`,
      ),
    ).toEqual(["1: Beauty", "2: Normal", "3: Beauty"])
  })

  it("collapses overlay labels into one viewport label", () => {
    const layout = resolveDebugViewLayout("overlay")

    expect(createDebugViewportLabels(DEFAULT_DEBUG_VIEWS.slice(0, 2), layout)).toEqual([
      "Beauty + Normal",
    ])
  })

  it("uses only explicit viewport plan cells for viewport-mode labels", () => {
    const plan = createDebugViewportPlan({
      views: DEFAULT_DEBUG_VIEWS,
      viewportViews: [{ view: "beauty" }, { view: "normal", label: "Normal pane" }],
      layout: { mode: "row", slots: 4 },
    })

    expect(createDebugViewportPlanLabels(plan)).toEqual(["Beauty", "Normal pane"])
  })

})
