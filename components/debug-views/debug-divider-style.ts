export type RgbColor = readonly [number, number, number]

export interface DebugDividerStyle {
  /** Normalized screen-space divider thickness. Defaults to a thin hairline. */
  lineWidth?: number
  /** Silver rim color at the divider edge (RGB 0–1). */
  edgeColor?: RgbColor
  /** Center fill color inside the divider (RGB 0–1). */
  coreColor?: RgbColor
}

export const DEFAULT_DIVIDER_LINE_WIDTH = 0.00028
export const DEFAULT_DIVIDER_EDGE_COLOR: RgbColor = [0.84, 0.87, 0.92]
export const DEFAULT_DIVIDER_CORE_COLOR: RgbColor = [0, 0, 0]

export function resolveDebugDividerStyle(
  style?: DebugDividerStyle,
): Required<DebugDividerStyle> {
  return {
    lineWidth: clampDividerLineWidth(style?.lineWidth ?? DEFAULT_DIVIDER_LINE_WIDTH),
    edgeColor: style?.edgeColor ?? DEFAULT_DIVIDER_EDGE_COLOR,
    coreColor: style?.coreColor ?? DEFAULT_DIVIDER_CORE_COLOR,
  }
}

export function clampDividerLineWidth(value: number) {
  return Math.max(0.00008, Math.min(value, 0.002))
}

export function rgbToLevaColor([r, g, b]: RgbColor) {
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  }
}

export function levaColorToRgb(color: { r: number; g: number; b: number }): RgbColor {
  return [color.r / 255, color.g / 255, color.b / 255]
}

export function layoutUsesDividers(layout: string) {
  return layout !== "single" && layout !== "overlay"
}
