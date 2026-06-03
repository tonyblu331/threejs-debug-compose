import type { DebugNode } from "./debug-views-tsl/node-types"
import type { DebugView, ViewMode } from "./debug-views-tsl/compositor"

export interface CustomDebugNodeViewOptions {
  /**
   * Stable identity for render-graph deduping.
   *
   * Reuse the same id only when two views are expected to render the same node
   * with the same visualization settings.
   */
  id: string
  label: string
  node: DebugNode
  mode?: ViewMode
  scale?: number
  bias?: number
}

export function createCustomDebugView({
  id,
  label,
  node,
  mode = "passthrough",
  scale,
  bias,
}: CustomDebugNodeViewOptions): DebugView {
  return {
    id,
    label,
    node,
    mode,
    scale,
    bias,
  }
}
