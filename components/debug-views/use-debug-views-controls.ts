import { useControls } from "leva"
import { getDebugViewLabels } from "./debug-view-definitions"

interface UseDebugViewsControlsOptions {
  viewLabels?: string[]
  maxLayoutSlots?: number
}

export function useDebugViewsControls(options: UseDebugViewsControlsOptions = {}) {
  const { viewLabels = getDebugViewLabels(), maxLayoutSlots } = options
  const slotLimit = Math.max(1, maxLayoutSlots ?? viewLabels.length)
  const defaultSlots = Math.min(4, slotLimit)

  const viewOptions: Record<string, number> = {}
  for (let i = 0; i < viewLabels.length; i++) {
    viewOptions[viewLabels[i]] = i
  }

  const controls = useControls("Debug", {
    enabled: { label: "Enabled", value: true },
    showLabels: { label: "Viewport labels", value: true },
    mode: {
      label: "Mode",
      value: "compose",
      options: {
        Compose: "compose",
        Viewport: "viewport",
      },
    },
    activeView: { label: "View", value: 0, options: viewOptions },
    layout: {
      label: "Layout",
      value: "single",
      options: {
        Single: "single",
        Overlay: "overlay",
        "Split H": "split-h",
        "Split V": "split-v",
        Quad: "quad",
        Row: "row",
        Column: "column",
        Grid: "grid",
      },
    },
    slots: {
      label: "Slots",
      value: defaultSlots,
      min: 1,
      max: slotLimit,
      step: 1,
    },
    columns: {
      label: "Columns",
      value: 2,
      min: 1,
      max: slotLimit,
      step: 1,
    },
    rows: {
      label: "Rows",
      value: 2,
      min: 1,
      max: slotLimit,
      step: 1,
    },
    overlayOpacity: {
      label: "Blend opacity",
      value: 0.35,
      min: 0,
      max: 1,
      step: 0.01,
    },
  })

  return controls
}
