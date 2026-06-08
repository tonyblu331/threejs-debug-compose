import type { DebugViewportView } from "../../components/debug-views/debug-viewport-plan"

export const SOCIAL_CAPTURE_VIEWPORT: readonly DebugViewportView[] = [
  { view: "normal" },
  { view: "shaderCost", label: "Complexity" },
  { view: "albedo", label: "Albedo" },
  { view: "depth" },
]

export const SOCIAL_CAPTURE_LAYOUT = "breakdown" as const
export const SOCIAL_CAPTURE_DIAGONAL_ANGLE = 13
