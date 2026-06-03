import type { DebugView } from "./debug-views-tsl/compositor"
import type { ResolvedDebugViewLayout } from "./debug-view-layout"
import type { DebugViewportPlan } from "./debug-viewport-plan"

export type DebugViewportLabel = string | undefined
export type DebugViewportLabelFormatter = (
  view: DebugView,
  viewportIndex: number,
) => DebugViewportLabel
export type DebugViewportLabels = readonly DebugViewportLabel[] | DebugViewportLabelFormatter

export function createDebugViewportLabels(
  views: readonly DebugView[],
  layout: ResolvedDebugViewLayout,
  labels?: DebugViewportLabels,
): string[] {
  if (views.length === 0) return []

  if (layout.presentation === "overlay") {
    return [resolveOverlayLabel(views, labels)]
  }

  if (layout.presentation === "single") {
    return [resolveViewportLabel(views[0], 0, labels)]
  }

  const viewportLabels: string[] = []
  for (let viewportIndex = 0; viewportIndex < layout.slots; viewportIndex++) {
    const view = views[viewportIndex] ?? views[0]
    viewportLabels.push(resolveViewportLabel(view, viewportIndex, labels))
  }

  return viewportLabels
}

export function createDebugViewportPlanLabels(
  plan: DebugViewportPlan,
  labels?: DebugViewportLabels,
): string[] {
  return plan.cells.map((cell) => resolveViewportLabel(cell.view, cell.index, labels))
}

function resolveOverlayLabel(
  views: readonly DebugView[],
  labels?: DebugViewportLabels,
): string {
  const explicitLabel = resolveExplicitLabel(views[0], 0, labels)
  if (explicitLabel !== undefined) return explicitLabel

  return views.map((view) => view.label).join(" + ")
}

function resolveViewportLabel(
  view: DebugView,
  viewportIndex: number,
  labels?: DebugViewportLabels,
): string {
  return resolveExplicitLabel(view, viewportIndex, labels) ?? view.label
}

function resolveExplicitLabel(
  view: DebugView,
  viewportIndex: number,
  labels?: DebugViewportLabels,
): string | undefined {
  const label = typeof labels === "function" ? labels(view, viewportIndex) : labels?.[viewportIndex]
  if (label === undefined) return undefined
  return label
}
