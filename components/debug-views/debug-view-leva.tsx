import { type ComponentProps, useEffect } from "react"
import { createRoot, type Root } from "react-dom/client"
import { Leva } from "leva"

export const DEBUG_VIEW_LEVA_THEME = {
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
} as const

export type DebugViewLevaProps = Omit<ComponentProps<typeof Leva>, "theme">

interface DebugViewLevaMount {
  container: HTMLDivElement
  root: Root
  refCount: number
}

let debugViewLevaMount: DebugViewLevaMount | null = null

function renderDebugViewLeva(props: DebugViewLevaProps = {}) {
  if (typeof document === "undefined" || !debugViewLevaMount) {
    return
  }

  const { collapsed = false, ...rest } = props

  debugViewLevaMount.root.render(
    <Leva collapsed={collapsed} theme={DEBUG_VIEW_LEVA_THEME} {...rest} />,
  )
}

export function mountDebugViewLeva(props: DebugViewLevaProps = {}) {
  if (typeof document === "undefined") {
    return () => {}
  }

  if (!debugViewLevaMount) {
    const container = document.createElement("div")
    container.setAttribute("data-debug-view-leva", "true")
    document.body.appendChild(container)
    debugViewLevaMount = {
      container,
      root: createRoot(container),
      refCount: 0,
    }
  }

  debugViewLevaMount.refCount += 1
  renderDebugViewLeva(props)

  return () => {
    if (!debugViewLevaMount) return

    debugViewLevaMount.refCount -= 1
    if (debugViewLevaMount.refCount > 0) return

    debugViewLevaMount.root.unmount()
    debugViewLevaMount.container.remove()
    debugViewLevaMount = null
  }
}

export function DebugViewLeva({
  collapsed = false,
}: DebugViewLevaProps) {
  useEffect(() => mountDebugViewLeva({ collapsed }), [collapsed])

  return null
}
