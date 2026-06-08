import { useMemo } from "react"
import { DebugViewLayer } from "threejs-debug-view/r3f"
import {
  DEFAULT_DEBUG_VIEWS,
  getDebugViewLabels,
  type DebugView,
} from "threejs-debug-view"
import { isSocialCapture } from "../demo/capture-mode"
import {
  SOCIAL_CAPTURE_DIAGONAL_ANGLE,
  SOCIAL_CAPTURE_LAYOUT,
  SOCIAL_CAPTURE_VIEWPORT,
} from "../demo/social-capture-preset"

const VIEW_LABELS = getDebugViewLabels()

export function DebugOverlay({ debugViewSource }: { debugViewSource?: string | null }) {
  const views = useMemo(
    (): DebugView[] => [...DEFAULT_DEBUG_VIEWS],
    [],
  )
  const forcedDebugView = import.meta.env.VITE_DEBUG_VIEW_CAPTURE || debugViewSource
  const forcedView = forcedDebugView
    ? views.findIndex((view) => view.source === forcedDebugView)
    : -1
  const socialCapture = isSocialCapture()

  return (
    <DebugViewLayer
      views={views}
      viewLabels={VIEW_LABELS}
      initialActiveView={forcedView < 0 ? 0 : forcedView}
      showEnabledControl={false}
      showLabels={socialCapture ? true : undefined}
      showLegends={socialCapture ? true : undefined}
      showLeva={socialCapture ? false : undefined}
      layout={socialCapture ? SOCIAL_CAPTURE_LAYOUT : undefined}
      diagonalAngle={socialCapture ? SOCIAL_CAPTURE_DIAGONAL_ANGLE : undefined}
      viewportViews={socialCapture ? SOCIAL_CAPTURE_VIEWPORT : undefined}
    />
  )
}
