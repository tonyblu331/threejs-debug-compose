import { useEffect, useMemo } from "react"
import { useControls } from "leva"
import { getDebugViewLabels } from "./debug-view-definitions"
import {
  DEFAULT_DIVIDER_CORE_COLOR,
  DEFAULT_DIVIDER_EDGE_COLOR,
  DEFAULT_DIVIDER_LINE_WIDTH,
  layoutUsesDividers,
  levaColorToRgb,
  rgbToLevaColor,
} from "./debug-divider-style"
import {
  createPaneAssignmentsKey,
  createViewportViews,
  getVisiblePaneCount,
  isPaneAssignmentLayout,
  usesPaneAssignments,
} from "./debug-views-controls"
import type { DebugViewsControlValues } from "./debug-views-options"
import type { DebugViewLayout } from "./debug-view-layout"
import type { DebugViewportView } from "./debug-viewport-plan"

export type { DebugViewsControlValues } from "./debug-views-options"

interface UseDebugViewsControlsOptions {
  viewLabels?: string[]
  maxPaneCount?: number
  initialActiveView?: number
  showEnabledControl?: boolean
}

interface StaticDebugViewControlsOptions {
  initialActiveView?: number
  layout?: DebugViewLayout
  diagonalAngle?: number
  showLabels?: boolean
  showLegends?: boolean
  viewportViews?: readonly DebugViewportView[]
}

export function createStaticDebugViewControls(
  options: StaticDebugViewControlsOptions = {},
): DebugViewsControlValues {
  return {
    enabled: true,
    showLabels: options.showLabels ?? true,
    showLegends: options.showLegends ?? true,
    activeView: Math.max(0, options.initialActiveView ?? 0),
    layout: options.layout ?? "single",
    paneCount: 4,
    columns: 2,
    rows: 2,
    diagonalAngle: options.diagonalAngle ?? 25,
    overlayOpacity: 0.35,
    lineWidth: DEFAULT_DIVIDER_LINE_WIDTH,
    edgeColor: DEFAULT_DIVIDER_EDGE_COLOR,
    coreColor: DEFAULT_DIVIDER_CORE_COLOR,
    viewportViews: options.viewportViews ? [...options.viewportViews] : undefined,
  }
}

export function useDebugViewsControls(
  options: UseDebugViewsControlsOptions = {},
): DebugViewsControlValues {
  const {
    viewLabels = getDebugViewLabels(),
    initialActiveView = 0,
    maxPaneCount,
    showEnabledControl = true,
  } = options
  const paneLimit = Math.max(1, maxPaneCount ?? viewLabels.length)
  const defaultPaneCount = Math.min(4, paneLimit)
  const paneControlCount = Math.min(8, paneLimit)

  const viewOptions = useMemo(() => {
    const options: Record<string, number> = {}
    for (let i = 0; i < viewLabels.length; i++) {
      options[viewLabels[i]] = i
    }
    return options
  }, [viewLabels])

  const [controls, setControls] = useControls("Debug", () => {
    const paneControls: Record<string, unknown> = {}
    for (let index = 0; index < paneControlCount; index++) {
      paneControls[`pane${index + 1}`] = {
        label: `Pane ${index + 1}`,
        value: Math.min(index, viewLabels.length - 1),
        options: viewOptions,
        render: (get: (path: string) => unknown) =>
          usesPaneAssignments(get) && index < getVisiblePaneCount(get),
      }
    }

    return {
      ...(showEnabledControl
        ? { enabled: { label: "Enabled", value: true } }
        : {}),
      showLabels: { label: "Viewport labels", value: true },
      showLegends: { label: "Diagnostic legends", value: true },
      activeView: {
        label: "View",
        value: Math.max(0, Math.min(initialActiveView, viewLabels.length - 1)),
        options: viewOptions,
        render: (get: (path: string) => unknown) => !usesPaneAssignments(get),
      },
      layout: {
        label: "Layout",
        value: "single",
        options: {
          Single: "single",
          Overlay: "overlay",
          "Split H": "split-h",
          "Split V": "split-v",
          "Split Diagonal": "split-diagonal",
          Breakdown: "breakdown",
          Quad: "quad",
          Row: "row",
          Column: "column",
          Grid: "grid",
        },
      },
      paneCount: {
        label: "Panes",
        value: defaultPaneCount,
        min: 1,
        max: paneLimit,
        step: 1,
        render: (get: (path: string) => unknown) => ["row", "column", "grid"].includes(String(get("Debug.layout"))),
      },
      columns: {
        label: "Columns",
        value: 2,
        min: 1,
        max: paneLimit,
        step: 1,
        render: (get: (path: string) => unknown) => get("Debug.layout") === "grid",
      },
      rows: {
        label: "Rows",
        value: 2,
        min: 1,
        max: paneLimit,
        step: 1,
        render: (get: (path: string) => unknown) => get("Debug.layout") === "grid",
      },
      diagonalAngle: {
        label: "Diagonal angle",
        value: 25,
        min: -45,
        max: 45,
        step: 1,
        render: (get: (path: string) => unknown) =>
          ["split-diagonal", "breakdown"].includes(String(get("Debug.layout"))),
      },
      overlayOpacity: {
        label: "Blend opacity",
        value: 0.35,
        min: 0,
        max: 1,
        step: 0.01,
        render: (get: (path: string) => unknown) => get("Debug.layout") === "overlay",
      },
      lineWidth: {
        label: "Divider width",
        value: DEFAULT_DIVIDER_LINE_WIDTH,
        min: 0.00008,
        max: 0.002,
        step: 0.00002,
        render: (get: (path: string) => unknown) =>
          layoutUsesDividers(String(get("Debug.layout"))),
      },
      edgeColor: {
        label: "Divider edge",
        value: rgbToLevaColor(DEFAULT_DIVIDER_EDGE_COLOR),
        render: (get: (path: string) => unknown) =>
          layoutUsesDividers(String(get("Debug.layout"))),
      },
      coreColor: {
        label: "Divider core",
        value: rgbToLevaColor(DEFAULT_DIVIDER_CORE_COLOR),
        render: (get: (path: string) => unknown) =>
          layoutUsesDividers(String(get("Debug.layout"))),
      },
      ...paneControls,
    }
  }, [defaultPaneCount, initialActiveView, paneControlCount, paneLimit, showEnabledControl, viewLabels.length, viewOptions])

  useEffect(() => {
    setControls({ activeView: Math.max(0, Math.min(initialActiveView, viewLabels.length - 1)) })
  }, [initialActiveView, setControls, viewLabels.length])

  const controlValues = controls as Record<string, unknown>
  const paneAssignmentsKey = createPaneAssignmentsKey(controlValues, paneControlCount)
  const viewportViews = useMemo(
    () => isPaneAssignmentLayout(controlValues.layout)
      ? createViewportViews(controlValues, paneControlCount)
      : undefined,
    [controlValues.layout, paneAssignmentsKey, paneControlCount],
  )

  return {
    ...(controls as DebugViewsControlValues),
    enabled: showEnabledControl ? Boolean(controlValues.enabled) : true,
    lineWidth: Number(controlValues.lineWidth ?? DEFAULT_DIVIDER_LINE_WIDTH),
    edgeColor: levaColorToRgb(controlValues.edgeColor as { r: number; g: number; b: number }),
    coreColor: levaColorToRgb(controlValues.coreColor as { r: number; g: number; b: number }),
    viewportViews,
  }
}
