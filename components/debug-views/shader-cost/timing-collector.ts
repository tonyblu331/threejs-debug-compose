export interface ShaderCostTimestampRenderer {
  backend?: unknown
  hasFeature?: (name: string) => boolean
  resolveTimestampsAsync?: (type?: "render" | "compute") => Promise<number | undefined>
}

export interface ShaderCostTimingSnapshot {
  elapsedMs?: number
  maxElapsedMs?: number
  minElapsedMs?: number
  position?: number
  precision: "gpu-quantized"
  sampleCount: number
  source: "webgpu-timestamp-query"
  status: "unsupported" | "sampling" | "measured" | "failed"
}

export interface ShaderCostTimingCollector {
  sample(): Promise<ShaderCostTimingSnapshot | undefined>
  getSnapshot(): ShaderCostTimingSnapshot
}

export function createShaderCostTimingCollector(
  renderer: ShaderCostTimestampRenderer,
): ShaderCostTimingCollector {
  let pending = false
  let sampleCount = 0
  let maxElapsedMs = 0
  let minElapsedMs = Number.POSITIVE_INFINITY
  let snapshot = createInitialSnapshot(renderer)

  return {
    async sample() {
      if (snapshot.status === "unsupported" || pending || !renderer.resolveTimestampsAsync) {
        return undefined
      }

      pending = true
      if (snapshot.status !== "measured") {
        snapshot = { ...snapshot, status: "sampling" }
      }

      try {
        const elapsedMs = await renderer.resolveTimestampsAsync("render")
        if (!Number.isFinite(elapsedMs) || elapsedMs === undefined || elapsedMs <= 0) {
          return snapshot
        }

        sampleCount += 1
        minElapsedMs = Math.min(minElapsedMs, elapsedMs)
        maxElapsedMs = Math.max(maxElapsedMs, elapsedMs)
        snapshot = {
          elapsedMs,
          maxElapsedMs,
          minElapsedMs,
          position: normalizeTimingPosition(elapsedMs, minElapsedMs, maxElapsedMs),
          precision: "gpu-quantized",
          sampleCount,
          source: "webgpu-timestamp-query",
          status: "measured",
        }

        return snapshot
      } catch {
        snapshot = {
          precision: "gpu-quantized",
          sampleCount,
          source: "webgpu-timestamp-query",
          status: "failed",
        }

        return snapshot
      } finally {
        pending = false
      }
    },
    getSnapshot() {
      return snapshot
    },
  }
}

function normalizeTimingPosition(elapsedMs: number, minElapsedMs: number, maxElapsedMs: number) {
  const range = maxElapsedMs - minElapsedMs
  if (range <= 0) return 0.5
  return Math.max(0, Math.min(1, (elapsedMs - minElapsedMs) / range))
}

function createInitialSnapshot(
  renderer: ShaderCostTimestampRenderer,
): ShaderCostTimingSnapshot {
  const supported = hasTimestampTracking(renderer.backend) &&
    renderer.hasFeature?.("timestamp-query") === true &&
    typeof renderer.resolveTimestampsAsync === "function"

  return {
    precision: "gpu-quantized",
    sampleCount: 0,
    source: "webgpu-timestamp-query",
    status: supported ? "sampling" : "unsupported",
  }
}

function hasTimestampTracking(backend: unknown) {
  return typeof backend === "object" &&
    backend !== null &&
    (backend as { trackTimestamp?: unknown }).trackTimestamp === true
}
