import { describe, expect, it } from "vitest"
import { UnsignedByteType } from "three"
import { float } from "three/tsl"
import {
  DEFAULT_DEBUG_VIEWS,
  getDebugViewLabels,
  MATERIAL_DEBUG_VIEW_SOURCES,
} from "./debug-view-definitions"
import { getResolvedDebugViewMode, selectPipelineViews } from "./debug-view-selection"
import { createDebugRenderPlan } from "./debug-render-plan"

describe("debug view definitions", () => {
  it("keeps the requested material debugger views registered", () => {
    expect(MATERIAL_DEBUG_VIEW_SOURCES).toEqual([
      "albedo",
      "materialNormal",
      "normalMap",
      "emissive",
      "roughness",
      "ao",
      "metallic",
      "opacity",
      "wireframe",
      "lightingOnly",
      "reflectionOnly",
      "shaderCost",
    ])
  })

  it("keeps labels aligned with the view list", () => {
    expect(getDebugViewLabels()).toEqual(DEFAULT_DEBUG_VIEWS.map((view) => view.label))
  })

  it("keeps the first four selectable views stable for regression coverage", () => {
    expect(DEFAULT_DEBUG_VIEWS.slice(0, 4).map((view) => view.source)).toEqual([
      "beauty",
      "normal",
      "depth",
      "albedo",
    ])
  })

  it("builds single-view pipelines from only the active view", () => {
    expect(selectPipelineViews(DEFAULT_DEBUG_VIEWS, 5, "single").map((view) => view.source)).toEqual([
      "emissive",
    ])
  })

  it("builds overlay pipelines from beauty and the active view only", () => {
    expect(selectPipelineViews(DEFAULT_DEBUG_VIEWS, 4, "overlay").map((view) => view.source)).toEqual([
      "beauty",
      "materialNormal",
    ])
  })

  it("plans scalar material views as one low-precision packed attachment", () => {
    const plan = createDebugRenderPlan(DEFAULT_DEBUG_VIEWS, 6, "single")

    expect(plan.views.map((view) => view.source)).toEqual(["roughness"])
    expect(plan.sceneOutputs).toEqual({ material: { roughness: true } })
    expect(plan.sceneTextureTypes).toEqual([{ name: "material", type: UnsignedByteType }])
    expect(plan.usesMaterialDetailPass).toBe(false)
  })

  it("plans material-normal without allocating emissive output", () => {
    const plan = createDebugRenderPlan(DEFAULT_DEBUG_VIEWS, 4, "single")

    expect(plan.materialDetailOutputs).toEqual({ materialNormal: true })
    expect(plan.materialDetailTextureTypes).toEqual([
      { name: "materialNormal", type: UnsignedByteType },
    ])
  })

  it("plans emissive without allocating material-normal output", () => {
    const plan = createDebugRenderPlan(DEFAULT_DEBUG_VIEWS, 5, "single")

    expect(plan.materialDetailOutputs).toEqual({ emissive: true })
    expect(plan.materialDetailTextureTypes).toEqual([])
  })

  it("plans lighting-only as a dedicated neutral-material pass", () => {
    const plan = createDebugRenderPlan(DEFAULT_DEBUG_VIEWS, 11, "single")

    expect(plan.views.map((view) => view.source)).toEqual(["lightingOnly"])
    expect(plan.sceneOutputs).toEqual({})
    expect(plan.usesLightingOnlyPass).toBe(true)
    expect(plan.sceneTextureTypes).toEqual([])
  })

  it("plans reflection-only as a dedicated reflective-material pass", () => {
    const plan = createDebugRenderPlan(DEFAULT_DEBUG_VIEWS, 12, "single")

    expect(plan.views.map((view) => view.source)).toEqual(["reflectionOnly"])
    expect(plan.sceneOutputs).toEqual({})
    expect(plan.materialDetailOutputs).toEqual({})
    expect(plan.usesReflectionOnlyPass).toBe(true)
    expect(plan.usesLightingOnlyPass).toBe(false)
    expect(plan.sceneTextureTypes).toEqual([])
    expect(plan.materialDetailTextureTypes).toEqual([])
  })

  it("plans shader-cost as a dedicated heatmap pass", () => {
    const plan = createDebugRenderPlan(DEFAULT_DEBUG_VIEWS, 13, "single")

    expect(plan.views.map((view) => view.source)).toEqual(["shaderCost"])
    expect(plan.views[0].mode).toBe("heatmap")
    expect(plan.sceneOutputs).toEqual({})
    expect(plan.materialDetailOutputs).toEqual({})
    expect(plan.usesShaderCostPass).toBe(true)
    expect(plan.usesReflectionOnlyPass).toBe(false)
    expect(plan.sceneTextureTypes).toEqual([])
    expect(plan.materialDetailTextureTypes).toEqual([])
  })

  it("does not double-encode built-in normal debug sources", () => {
    expect(getResolvedDebugViewMode({ label: "Legacy Normal", mode: "normal" })).toBe("passthrough")
    expect(getResolvedDebugViewMode({ label: "Custom Normal", mode: "normal", node: float(1) })).toBe(
      "normal",
    )
  })

  it("keeps custom heatmap nodes encoded by the compositor", () => {
    expect(getResolvedDebugViewMode({ label: "Cost", mode: "heatmap", node: float(0.5) })).toBe(
      "heatmap",
    )
  })
})
