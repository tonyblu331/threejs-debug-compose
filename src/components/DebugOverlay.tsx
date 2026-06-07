import { useMemo } from "react"
import {
  DEFAULT_DEBUG_VIEWS,
  getDebugViewLabels,
  type DebugView,
} from "@/components/debug-views"
import {
  DebugViewLayer,
  DebugViews,
} from "../../components/debug-views/r3f"

const VIEW_LABELS = getDebugViewLabels()
const FORCED_DEBUG_VIEW_SOURCE =
  import.meta.env.VITE_DEBUG_VIEW_CAPTURE ||
  new URLSearchParams(window.location.search).get("debugView")

export function DebugOverlay() {
  const views = useMemo(
    (): DebugView[] => [...DEFAULT_DEBUG_VIEWS],
    [],
  )
  const forcedView = FORCED_DEBUG_VIEW_SOURCE
    ? views.findIndex((view) => view.source === FORCED_DEBUG_VIEW_SOURCE)
    : -1

  if (forcedView < 0) {
    return <DebugViewLayer views={views} viewLabels={VIEW_LABELS} />
  }

  return (
    <DebugViews
      views={views}
      activeView={forcedView}
      showLabels
    />
  )
}
