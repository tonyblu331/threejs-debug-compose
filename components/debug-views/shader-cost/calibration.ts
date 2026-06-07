export type ShaderCostTimingSource =
  | "webgpu-timestamp-query"
  | "native-profiler"
  | "manual"

export type ShaderCostTimingPrecision =
  | "gpu-exact"
  | "gpu-quantized"
  | "os-sampler"
  | "cpu-approx"

export interface ShaderCostTimingSample {
  elapsedMs: number
  predictedCost: number
  coveredPixels: number
  source: ShaderCostTimingSource
  precision: ShaderCostTimingPrecision
}

export interface ShaderCostCalibration {
  confidence: number
  nsPerPixel: number
  precision: ShaderCostTimingPrecision
  sampleCount: number
  source: ShaderCostTimingSource
  status: "measured" | "insufficient-samples" | "invalid"
}

const MIN_CALIBRATION_SAMPLES = 8
const GPU_QUANTIZED_CONFIDENCE_CAP = 0.55
const GPU_EXACT_CONFIDENCE_CAP = 0.85
const OS_SAMPLER_CONFIDENCE_CAP = 0.35
const CPU_APPROX_CONFIDENCE_CAP = 0.2

export function createShaderCostCalibration(
  samples: readonly ShaderCostTimingSample[],
): ShaderCostCalibration {
  const validSamples = samples
    .map(normalizeSample)
    .filter((sample): sample is NormalizedTimingSample => sample !== undefined)

  if (validSamples.length === 0) {
    return emptyCalibration("invalid")
  }

  const nsPerPixel = median(validSamples.map((sample) => sample.nsPerPixel))
  const precision = getWeakestPrecision(validSamples.map((sample) => sample.precision))
  const source = getCalibrationSource(validSamples)
  const confidenceCap = getPrecisionConfidenceCap(precision)
  const confidence = validSamples.length < MIN_CALIBRATION_SAMPLES
    ? confidenceCap * (validSamples.length / MIN_CALIBRATION_SAMPLES)
    : confidenceCap

  return {
    confidence,
    nsPerPixel,
    precision,
    sampleCount: validSamples.length,
    source,
    status: validSamples.length >= MIN_CALIBRATION_SAMPLES ? "measured" : "insufficient-samples",
  }
}

export function applyShaderCostCalibration(
  predictedCost: number,
  calibration: ShaderCostCalibration | undefined,
): number {
  const staticCost = clamp01(predictedCost)
  if (!calibration || calibration.status !== "measured") return staticCost

  const measuredCost = clamp01(Math.log1p(calibration.nsPerPixel) / Math.log1p(100))
  return clamp01(
    calibration.confidence * measuredCost +
    (1 - calibration.confidence) * staticCost,
  )
}

interface NormalizedTimingSample extends ShaderCostTimingSample {
  nsPerPixel: number
}

function normalizeSample(sample: ShaderCostTimingSample): NormalizedTimingSample | undefined {
  if (
    !Number.isFinite(sample.elapsedMs) ||
    !Number.isFinite(sample.coveredPixels) ||
    sample.elapsedMs <= 0 ||
    sample.coveredPixels <= 0
  ) {
    return undefined
  }

  return {
    ...sample,
    predictedCost: clamp01(sample.predictedCost),
    nsPerPixel: sample.elapsedMs * 1_000_000 / sample.coveredPixels,
  }
}

function emptyCalibration(status: ShaderCostCalibration["status"]): ShaderCostCalibration {
  return {
    confidence: 0,
    nsPerPixel: 0,
    precision: "cpu-approx",
    sampleCount: 0,
    source: "manual",
    status,
  }
}

function getCalibrationSource(samples: readonly NormalizedTimingSample[]) {
  if (samples.some((sample) => sample.source === "native-profiler")) return "native-profiler"
  if (samples.some((sample) => sample.source === "webgpu-timestamp-query")) {
    return "webgpu-timestamp-query"
  }
  return "manual"
}

function getWeakestPrecision(
  precisions: readonly ShaderCostTimingPrecision[],
): ShaderCostTimingPrecision {
  if (precisions.includes("cpu-approx")) return "cpu-approx"
  if (precisions.includes("os-sampler")) return "os-sampler"
  if (precisions.includes("gpu-quantized")) return "gpu-quantized"
  return "gpu-exact"
}

function getPrecisionConfidenceCap(precision: ShaderCostTimingPrecision) {
  switch (precision) {
    case "gpu-exact":
      return GPU_EXACT_CONFIDENCE_CAP
    case "gpu-quantized":
      return GPU_QUANTIZED_CONFIDENCE_CAP
    case "os-sampler":
      return OS_SAMPLER_CONFIDENCE_CAP
    case "cpu-approx":
      return CPU_APPROX_CONFIDENCE_CAP
  }
}

function median(values: readonly number[]) {
  const sorted = [...values].sort((a, b) => a - b)
  const midpoint = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[midpoint - 1] + sorted[midpoint]) / 2
    : sorted[midpoint]
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}
