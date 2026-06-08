import { useEffect } from "react"
import {
  DEFAULT_DEBUG_VIEWS,
  getDebugViewLabels,
} from "./debug-view-definitions"
import { DebugViews } from "./debug-views-r3f"
import type { DebugViewsOptions } from "./debug-views-options"
import { mountDebugViewLeva } from "./debug-view-leva"
import {
  createStaticDebugViewControls,
  useDebugViewsControls,
} from "./use-debug-views-controls"
import type { DebugView } from "./debug-views-tsl/compositor"
import type { DebugViewLayout } from "./debug-view-layout"
import type { DebugViewportView } from "./debug-viewport-plan"

type DebugViewLayerControlledProps =
  | "activeView"
  | "columns"
  | "diagonalAngle"
  | "enabled"
  | "layout"
  | "overlayOpacity"
  | "paneCount"
  | "rows"
  | "slots"
  | "viewportViews"
  | "views"

export interface DebugViewLayerProps
  extends Omit<DebugViewsOptions, DebugViewLayerControlledProps> {
  views?: readonly DebugView[]
  viewLabels?: string[]
  initialActiveView?: number
  maxLayoutSlots?: number
  maxPaneCount?: number
  showEnabledControl?: boolean
  /** Override Leva viewport label toggle. */
  showLabels?: boolean
  /** Override Leva diagnostic legend toggle. */
  showLegends?: boolean
  /** Override Leva layout preset. */
  layout?: DebugViewLayout
  /** Override Leva diagonal angle. */
  diagonalAngle?: number
  /** Override Leva pane assignments. */
  viewportViews?: readonly DebugViewportView[]
  /** Mount the bundled Leva control panel. Defaults to `true`. */
  showLeva?: boolean
}

export function DebugViewLayer(props: DebugViewLayerProps) {
  if (props.showLeva === false) {
    return <DebugViewLayerHeadless {...props} />
  }

  return <DebugViewLayerWithLeva {...props} />
}

function DebugViewLayerHeadless({
  initialActiveView,
  views = DEFAULT_DEBUG_VIEWS,
  showEnabledControl: _showEnabledControl,
  showLabels,
  showLegends,
  layout,
  diagonalAngle,
  viewportViews,
  showLeva: _showLeva,
  ...props
}: DebugViewLayerProps) {
  const controls = createStaticDebugViewControls({
    initialActiveView,
    layout,
    diagonalAngle,
    showLabels,
    showLegends,
    viewportViews,
  })

  return (
    <DebugViews
      views={views}
      {...controls}
      {...props}
      {...(showLabels !== undefined ? { showLabels } : {})}
      {...(showLegends !== undefined ? { showLegends } : {})}
      {...(layout !== undefined ? { layout } : {})}
      {...(diagonalAngle !== undefined ? { diagonalAngle } : {})}
      {...(viewportViews !== undefined ? { viewportViews: [...viewportViews] } : {})}
    />
  )
}

function DebugViewLayerWithLeva({
  initialActiveView,
  views = DEFAULT_DEBUG_VIEWS,
  viewLabels = getDebugViewLabels(views),
  maxLayoutSlots,
  maxPaneCount,
  showEnabledControl,
  showLabels,
  showLegends,
  layout,
  diagonalAngle,
  viewportViews,
  showLeva = true,
  ...props
}: DebugViewLayerProps) {
  const controls = useDebugViewsControls({
    initialActiveView,
    viewLabels,
    maxPaneCount: maxPaneCount ?? maxLayoutSlots,
    showEnabledControl,
  })

  useEffect(() => {
    if (!showLeva) return
    return mountDebugViewLeva()
  }, [showLeva])

  return (
    <DebugViews
      views={views}
      {...controls}
      {...props}
      {...(showLabels !== undefined ? { showLabels } : {})}
      {...(showLegends !== undefined ? { showLegends } : {})}
      {...(layout !== undefined ? { layout } : {})}
      {...(diagonalAngle !== undefined ? { diagonalAngle } : {})}
      {...(viewportViews !== undefined ? { viewportViews: [...viewportViews] } : {})}
    />
  )
}
