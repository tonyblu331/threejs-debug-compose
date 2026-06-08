import { uniform, vec4 } from "three/tsl"
import {
  resolveDebugDividerStyle,
  type DebugDividerStyle,
} from "../debug-divider-style"
import {
  LAYOUT_INDEX,
  resolveDebugViewLayout,
  type DebugViewLayout,
} from "../debug-view-layout"

export type { DebugViewLayout, LayoutMode } from "../debug-view-layout"

export function createDebugViewUniforms() {
  const divider = resolveDebugDividerStyle()

  return {
    activeView: uniform(0),
    layout: uniform(0),
    viewCount: uniform(3),
    gridColumns: uniform(2),
    gridRows: uniform(2),
    diagonalSlope: uniform(0),
    overlayOpacity: uniform(0.35),
    dividerLineWidth: uniform(divider.lineWidth),
    dividerEdgeColor: uniform(vec4(...divider.edgeColor, 1)),
    dividerCoreColor: uniform(vec4(...divider.coreColor, 1)),
  }
}

export type DebugViewUniforms = ReturnType<typeof createDebugViewUniforms>

export function updateDebugViewUniforms(
  uniforms: DebugViewUniforms,
  activeView: number,
  layout: DebugViewLayout = "single",
  viewCount: number = 1,
  overlayOpacity: number = 0.35,
  dividerStyle?: DebugDividerStyle,
) {
  const resolvedLayout = resolveDebugViewLayout(layout)
  const safeViewCount = Math.max(1, viewCount)
  const divider = resolveDebugDividerStyle(dividerStyle)

  uniforms.activeView.value = Math.max(0, Math.min(activeView, safeViewCount - 1))
  uniforms.layout.value = LAYOUT_INDEX[resolvedLayout.mode]
  uniforms.viewCount.value = safeViewCount
  uniforms.gridColumns.value = resolvedLayout.columns
  uniforms.gridRows.value = resolvedLayout.rows
  uniforms.diagonalSlope.value = Math.tan(resolvedLayout.diagonalAngle * Math.PI / 180)
  uniforms.overlayOpacity.value = Math.max(0, Math.min(overlayOpacity, 1))
  uniforms.dividerLineWidth.value = divider.lineWidth
  uniforms.dividerEdgeColor.value.set(divider.edgeColor[0], divider.edgeColor[1], divider.edgeColor[2], 1)
  uniforms.dividerCoreColor.value.set(divider.coreColor[0], divider.coreColor[1], divider.coreColor[2], 1)
}
