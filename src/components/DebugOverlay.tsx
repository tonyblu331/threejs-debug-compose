import { useMemo } from "react"
import { Leva } from "leva"
import {
  DEFAULT_DEBUG_VIEWS,
  getDebugViewLabels,
  type DebugView,
  type DebugViewsMode,
  type LayoutMode,
} from "@/components/debug-views"
import {
  DebugViews,
  useDebugViewsControls,
} from "../../components/debug-views/r3f"

const VIEW_LABELS = getDebugViewLabels()
const FORCE_SHADER_COST_VIEW =
  import.meta.env.VITE_DEBUG_VIEW_CAPTURE === "shader-cost" ||
  new URLSearchParams(window.location.search).get("debugView") === "shaderCost"

const neutralLevaTheme = {
  colors: {
    elevation1: "#050505",
    elevation2: "#111111",
    elevation3: "#1c1c1c",
    accent1: "#2a2a2a",
    accent2: "#d8d8d8",
    accent3: "#ffffff",
    highlight1: "#7a7a7a",
    highlight2: "#d8d8d8",
    highlight3: "#ffffff",
    vivid1: "#ffffff",
  },
  radii: {
    xs: "0px",
    sm: "0px",
    lg: "0px",
  },
  shadows: {
    level1: "none",
    level2: "none",
  },
}

export function DebugOverlay() {
  const controls = useDebugViewsControls({ viewLabels: VIEW_LABELS })
  const shaderCostView = VIEW_LABELS.indexOf("Estimated Shader Complexity")
  const activeView =
    FORCE_SHADER_COST_VIEW && shaderCostView >= 0
      ? shaderCostView
      : controls.activeView as number

  const views = useMemo(
    (): DebugView[] => [...DEFAULT_DEBUG_VIEWS],
    [],
  )

  return (
    <>
      <Leva collapsed={false} flat theme={neutralLevaTheme} />
      <DebugViews
        views={views}
        mode={controls.mode as DebugViewsMode}
        activeView={activeView}
        layout={controls.layout as LayoutMode}
        slots={controls.slots as number}
        columns={controls.columns as number}
        rows={controls.rows as number}
        showLabels={controls.showLabels}
        overlayOpacity={controls.overlayOpacity as number}
        enabled={controls.enabled}
      />
    </>
  )
}
