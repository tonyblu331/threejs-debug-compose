import { describe, expect, it } from "vitest"
import { createShaderCostTimingCollector } from "./timing-collector"

describe("shader cost timing collector", () => {
  it("reports unsupported when timestamp tracking is unavailable", async () => {
    const collector = createShaderCostTimingCollector({
      backend: { trackTimestamp: false },
      hasFeature: () => true,
      resolveTimestampsAsync: async () => 1,
    })

    expect(collector.getSnapshot().status).toBe("unsupported")
    expect(await collector.sample()).toBeUndefined()
  })

  it("collects measured render timestamp samples", async () => {
    let elapsedMs = 0.18
    const collector = createShaderCostTimingCollector({
      backend: { trackTimestamp: true },
      hasFeature: () => true,
      resolveTimestampsAsync: async () => elapsedMs,
    })

    const first = await collector.sample()
    elapsedMs = 0.24
    const second = await collector.sample()

    expect(first).toMatchObject({
      elapsedMs: 0.18,
      maxElapsedMs: 0.18,
      minElapsedMs: 0.18,
      position: 0.5,
      precision: "gpu-quantized",
      sampleCount: 1,
      source: "webgpu-timestamp-query",
      status: "measured",
    })
    expect(second).toMatchObject({
      elapsedMs: 0.24,
      maxElapsedMs: 0.24,
      minElapsedMs: 0.18,
      position: 1,
      sampleCount: 2,
    })
  })

  it("marks failed timestamp resolves without throwing", async () => {
    const collector = createShaderCostTimingCollector({
      backend: { trackTimestamp: true },
      hasFeature: () => true,
      resolveTimestampsAsync: async () => {
        throw new Error("query failed")
      },
    })

    const snapshot = await collector.sample()

    expect(snapshot?.status).toBe("failed")
  })
})
