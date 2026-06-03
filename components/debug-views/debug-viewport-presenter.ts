import type { DebugViewportPlan } from "./debug-viewport-plan"

export interface DebugViewportNormalizedRect {
  x: number
  y: number
  width: number
  height: number
}

export interface DebugViewportCssCell {
  column: number
  row: number
}

export interface DebugViewportRect {
  index: number
  css: DebugViewportCssCell
  scissor: DebugViewportNormalizedRect
}

export function createDebugViewportRects(plan: DebugViewportPlan): DebugViewportRect[] {
  const { columns, rows } = plan.layout
  const width = 1 / columns
  const height = 1 / rows

  return plan.cells.map((cell) => {
    const columnIndex = cell.index % columns
    const rowIndex = Math.floor(cell.index / columns)

    return {
      index: cell.index,
      css: {
        column: columnIndex + 1,
        row: rowIndex + 1,
      },
      scissor: {
        x: roundUnit(columnIndex * width),
        y: roundUnit(1 - (rowIndex + 1) * height),
        width: roundUnit(width),
        height: roundUnit(height),
      },
    }
  })
}

export interface DebugViewportDrawingBufferSize {
  width: number
  height: number
}

export interface DebugViewportPixelRect {
  x: number
  y: number
  width: number
  height: number
}

export function toDebugViewportPixels(
  rect: DebugViewportNormalizedRect,
  drawingBufferSize: DebugViewportDrawingBufferSize,
): DebugViewportPixelRect {
  return {
    x: Math.round(rect.x * drawingBufferSize.width),
    y: Math.round(rect.y * drawingBufferSize.height),
    width: Math.round(rect.width * drawingBufferSize.width),
    height: Math.round(rect.height * drawingBufferSize.height),
  }
}

function roundUnit(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000
}