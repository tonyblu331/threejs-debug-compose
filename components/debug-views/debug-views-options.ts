import type { DebugDividerStyle, RgbColor } from "./debug-divider-style"
import type { DebugViewLayout } from "./debug-view-layout"
import type { DebugViewportLabels } from "./debug-viewport-labels"
import type { DebugViewportView } from "./debug-viewport-plan"
import type { DebugView } from "./debug-views-tsl/compositor"

export type { DebugDividerStyle, RgbColor } from "./debug-divider-style"

export interface DebugViewsOptions extends DebugDividerStyle {
  views: readonly DebugView[]
  viewportViews?: DebugViewportView[]
  activeView?: number
  layout?: DebugViewLayout
  paneCount?: number
  columns?: number
  rows?: number
  diagonalAngle?: number
  maxDiagonalAngle?: number
  showLabels?: boolean
  /** Bottom diagnostic legends (shader cost ramp, overlap ramp). Defaults to `true`. */
  showLegends?: boolean
  viewportLabels?: DebugViewportLabels
  overlayOpacity?: number
  enabled?: boolean
}

export type DebugViewsControlValues = Required<
  Pick<
    DebugViewsOptions,
    | "activeView"
    | "columns"
    | "coreColor"
    | "diagonalAngle"
    | "edgeColor"
    | "enabled"
    | "layout"
    | "lineWidth"
    | "overlayOpacity"
    | "paneCount"
    | "rows"
    | "showLabels"
    | "showLegends"
  >
> &
  Pick<DebugViewsOptions, "viewportViews">
