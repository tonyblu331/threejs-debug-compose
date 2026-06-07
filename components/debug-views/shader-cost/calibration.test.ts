import { describe, expect, it } from "vitest"
import {
  applyShaderCostCalibration,
  createShaderCostCalibration,
  type ShaderCostTimingSample,
} from "./calibration"

describe("shader cost calibration", () => {
  it("builds a measured calibration from enough WebGPU timestamp samples", () => {
    const calibration = createShaderCostCalibration(createSamples(8))

    expect(calibration.status).toBe("measured")
    expect(calibration.source).toBe("webgpu-timestamp-query")
    expect(calibration.precision).toBe("gpu-quantized")
    expect(calibration.sampleCount).toBe(8)
    expect(calibration.confidence).toBeGreaterThan(0)
    expect(calibration.confidence).toBeLessThanOrEqual(0.55)
    expect(calibration.nsPerPixel).toBeGreaterThan(0)
  })

  it("keeps calibration below measured status until enough samples exist", () => {
    const calibration = createShaderCostCalibration(createSamples(4))

    expect(calibration.status).toBe("insufficient-samples")
    expect(calibration.confidence).toBeLessThan(0.55)
    expect(applyShaderCostCalibration(0.25, calibration)).toBe(0.25)
  })

  it("rejects invalid timing samples", () => {
    const calibration = createShaderCostCalibration([
      {
        coveredPixels: 0,
        elapsedMs: 1,
        precision: "gpu-exact",
        predictedCost: 0.5,
        source: "webgpu-timestamp-query",
      },
    ])

    expect(calibration.status).toBe("invalid")
    expect(calibration.confidence).toBe(0)
  })

  it("blends measured timing with the static prediction without claiming instruction counts", () => {
    const calibration = createShaderCostCalibration(createSamples(8))
    const calibrated = applyShaderCostCalibration(0.2, calibration)

    expect(calibrated).not.toBe(0.2)
    expect(calibrated).toBeGreaterThanOrEqual(0)
    expect(calibrated).toBeLessThanOrEqual(1)
  })
})

function createSamples(count: number): ShaderCostTimingSample[] {
  return Array.from({ length: count }, (_, index) => ({
    coveredPixels: 512 * 512,
    elapsedMs: 0.18 + index * 0.001,
    precision: "gpu-quantized",
    predictedCost: 0.35,
    source: "webgpu-timestamp-query",
  }))
}
