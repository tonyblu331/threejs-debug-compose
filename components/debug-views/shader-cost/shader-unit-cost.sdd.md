# SDD: Shader Unit Cost Model

## Problem

The current shader-cost view is labeled honestly as an estimate, but the estimator is still too material-class based. Values like `MeshStandardMaterial` vs `MeshPhysicalMaterial` are proxies. Engines and GPU tools tend to reason closer to compiled shader work:

- instruction count
- ALU operation count
- texture/sample count
- control-flow and discard behavior
- fragment accumulation across overdraw
- measured timing when available

So the shader-cost view should move from:

```text
material family weights
```

to:

```text
shader-unit style feature accounting + optional measured calibration
```

## Research Baseline

### Unreal Engine

Unreal Shader Complexity visualizes shader instruction count per pixel. Unreal documents that only instruction count is used, and that this is approximate because texture lookups, loops, and instruction types can have different real costs.

Source: https://dev.epicgames.com/documentation/unreal-engine/view-modes?application_version=4.27

Important implication:

- shader complexity is closer to accumulated shader instruction pressure than material type
- instruction count is useful but not complete truth
- Unreal's scale cap is a visualization range, not a hardware unit budget

Community confirmation:

- Epic forum answer: shader complexity is accumulated instruction count from all fragments for a pixel.
- Reddit/forum caution: equal instruction counts can differ on real GPUs because instruction classes have different cycle behavior and compilers may combine operations.

Sources:

- https://forums.unrealengine.com/t/shader-complexity-breakdown/438973
- https://www.reddit.com/r/unrealengine/comments/13sk18n/does_landscape_shader_complexity_really_matter/

### Android GPU Inspector

Android GPU Inspector exposes shader performance statistics from static shader analysis and SPIR-V, including ALU instruction counts. This is closer to a shader-unit model than material feature weighting.

Source: https://developer.android.com/agi/frame-trace/shader-performance

Important implication:

- ALU and texture work should be separate channels
- compiled/intermediate shader code is the best source when available

### NVIDIA Nsight / Apple Xcode / AMD RGP

NVIDIA Nsight Shader Profiler reports instruction execution, thread-instruction execution, predicated-on execution, active threads per warp, instruction mix, and stall reasons. Apple’s shader cost graph separates ALU and non-ALU cost. AMD RGP/RGA separates theoretical occupancy, measured occupancy, VGPR/SGPR pressure, and latency hiding behavior.

Sources:

- https://docs.nvidia.com/nsight-graphics/UserGuide/shader-profiler.html
- https://developer.apple.com/documentation/xcode/analyzing-apple-gpu-performance-using-shader-cost-graph-a17-m3/
- https://gpuopen.com/learn/occupancy-explained/

Important implication:

- a mature shader-cost view is not a single material-class number
- it distinguishes operation classes and runtime behavior
- occupancy and stall reasons are vendor/native-profiler evidence, not browser WebGPU evidence

### Browser WebGPU Timestamp Queries

WebGPU exposes optional `timestamp-query` support. Chrome 121 supports `timestampWrites` on render and compute pass descriptors when the adapter exposes the feature. Chrome normally quantizes timestamp values to 100 microseconds; developer flags can remove quantization for local profiling.

Sources:

- https://developer.chrome.com/blog/new-in-webgpu-121
- https://developer.chrome.com/blog/new-in-webgpu-120
- https://webgpufundamentals.org/webgpu/lessons/webgpu-timing.html
- https://toji.dev/webgpu-profiling/timestamp-queries.html

Local profiler result:

- `gpu_doctor` found browser `timestamp-query` support and Windows native GPU Engine sampling.
- Exact capture was blocked because the app does not expose the profiler detector metadata required by the tool.
- Hybrid capture succeeded with `gpu-quantized` precision for `http://localhost:3002/?debugView=shaderCost`.
- The shader-cost pass measured about `0.18ms p50 / 0.22ms p95`, but ALU ops, instruction counts, occupancy, cache misses, and source hotspots were not captured.

Important implication:

- timestamp queries are valid for pass/dispatch timing and calibration
- they are not ALU counters, texture counters, native instruction counts, or shader occupancy evidence
- sub-0.2ms deltas are below the current quantized precision bar and should not drive code changes

### Unity

Unity does not provide an Unreal-equivalent built-in shader complexity mode in the same way, but compiled shader inspection can expose instruction counts for shader variants.

Source: https://stackoverflow.com/questions/18736098/unity3d-show-count-operations-in-shader

Important implication:

- shader variant/source compilation matters
- runtime material class alone is insufficient

## Target Contract

The user-facing view remains:

```text
Estimated Shader Complexity
```

But the score should be backed by a shader-unit feature vector:

```ts
interface ShaderUnitCostFeatures {
  aluOps: number
  textureOps: number
  dependentTextureOps: number
  branchOps: number
  discardOps: number
  derivativeOps: number
  transcendentalOps: number
  interpolatorPressure: number
  uniformPressure: number
  precisionPressure: number
  bandwidthPressure: number
  source: "compiled-shader" | "generated-wgsl" | "three-node-graph" | "material-proxy"
  confidence: number
}
```

The heatmap should represent:

```text
estimated fragment shader work per visible fragment
```

It should not represent:

- overdraw layer count
- native hardware cycles
- exact hardware shader unit occupancy

Those are separate signals.

## Scoring Model

Replace broad material-family weights with weighted shader-unit buckets:

```text
shaderUnitCost =
  aluOps * aluWeight
  + textureOps * textureWeight
  + dependentTextureOps * dependentTextureWeight
  + branchOps * branchWeight
  + discardOps * discardWeight
  + derivativeOps * derivativeWeight
  + transcendentalOps * transcendentalWeight
  + interpolatorPressure * interpolatorWeight
  + bandwidthPressure * bandwidthWeight

estimatedShaderComplexity =
  normalize(shaderUnitCost, referenceScale)
```

Weights are not arbitrary material constants. They are named cost classes and must be documented.

Default weights are named calibration buckets, not claims about native cycles:

```text
ALU = 1
texture sample = 4
dependent texture sample = 6
branch = 2
discard/alpha kill = 3
derivative = 2
transcendental = 4
extra interpolator = 0.5
high bandwidth texture = 2
```

These are still estimates, but they map to shader-unit categories instead of material names.

Rules:

- Every score must carry `source` and `confidence`.
- `material-proxy` source means static estimate only.
- `generated-wgsl` or `compiled-shader` source is required before claiming instruction-like counts.
- timestamp query calibration may adjust normalization and confidence, but must not create fake ALU/TEX counters.
- calibration constants are confidence policy gates:
  - `gpu-exact` may carry high confidence
  - `gpu-quantized` is capped lower because Chrome commonly quantizes timestamp values
  - `os-sampler` and `cpu-approx` are context only
  - fewer than 8 samples is insufficient for measured status

## Source Priority

### 1. Compiled / Generated Shader Source

Best available source.

For Three/WebGPU, investigate stable access to:

- generated WGSL
- node builder state
- pipeline shader code from `renderer.debug.getShaderAsync(...)`

If source is available, parse/count:

- texture sample calls
- branches
- loops
- discard / alpha kill
- derivatives
- math/transcendental ops
- varyings/interpolators

### 2. Three Node Graph Metadata

If generated source is not stable, inspect known Three/TSL node structures where available.

This should still produce shader-unit buckets, not material-family scores.

### 3. Material Proxy Fallback

Only use material/runtime properties as a fallback:

- material family maps to a baseline operation profile
- texture slots map to texture operation estimates
- physical lobes map to extra BRDF operation estimates
- transparency/alpha maps map to discard/branch estimates

This fallback must expose low confidence.

## Accumulation With Overdraw

Shader complexity and overdraw remain separate views.

But a combined pressure view can be:

```text
shaderPressure = estimatedShaderComplexity * measuredPixelOverdraw
```

Rules:

- `shaderCost` alone shows estimated per-fragment shader work
- `overdraw` alone shows measured/repeated pixel coverage
- `shaderPressure` can combine them later

## UI Contract

The shader-cost legend should avoid `cheap/expensive` if the view becomes richer. Better labels:

- `low instruction pressure`
- `high instruction pressure`

or:

- `low shader work`
- `high shader work`

Details panel / tooltip should show the feature vector:

```text
Estimated Shader Complexity
source: generated WGSL
confidence: 0.72
ALU: 34
Texture samples: 5
Dependent samples: 1
Branches/discards: 2
Physical lobes: clearcoat, sheen
```

## Implementation Plan

### Phase 1: Rename Data Model

Replace `ShaderCostFeatures` fields with shader-unit categories while preserving compatibility wrappers.

Files:

- `components/debug-views/shader-cost/material-cost.ts`
- `components/debug-views/shader-cost/material-cost.test.ts`

Acceptance:

- tests assert individual feature buckets, not just total score
- score signals include `alu`, `texture-samples`, `branches`, `discard`

### Phase 2: Material Proxy Profiles

Build material fallback profiles:

```ts
const MATERIAL_BASELINE_PROFILES = {
  basic: { aluOps: 1, textureOps: 0 },
  lambert: { aluOps: 6, textureOps: 0 },
  phong: { aluOps: 14, textureOps: 0 },
  standard: { aluOps: 28, textureOps: 0 },
  physical: { aluOps: 42, textureOps: 0 },
}
```

Texture slots add explicit `textureOps`, not hidden weighted texel load.

Acceptance:

- `MeshStandardMaterial({ map, normalMap })` reports `textureOps: 2`
- alpha-mapped foliage reports `textureOps >= 1` and `discardOps >= 1`
- physical clearcoat/sheen adds ALU/branch/profile signals

### Phase 3: Generated Shader Inspection Spike

Investigate whether Three r184 can expose generated shader code in a stable enough way:

- `renderer.debug.getShaderAsync(scene, camera, object)`
- render object builder state
- generated WGSL string access

Acceptance:

- if stable, add parser behind feature flag
- if unstable, document why material proxy remains fallback

### Phase 4: Calibration

Use timestamp-capable WebGPU to calibrate profiles:

- fixed fullscreen/mesh fixtures
- warmup frames
- median time per covered pixel
- confidence score

Acceptance:

- calibration shifts texture-heavy shaders higher when local GPU timing proves it
- unavailable timestamps leave the static model intact
- quantized timestamps are used only for large pass-level deltas
- exact profiler traces or vendor/native traces are required for hotspot/instruction claims

## Non-Goals

- Do not claim native instruction count unless generated/compiled source actually provides it.
- Do not claim native shader unit occupancy from browser APIs.
- Do not merge overdraw into shader cost.
- Do not use material class as the final score.

## Verification

```bash
pnpm typecheck
pnpm test
pnpm build:demo
```

Visual QA:

- basic unlit object stays low
- standard PBR object rises through ALU profile
- normal/roughness/metalness maps add texture sample pressure
- alpha foliage adds texture + discard pressure
- `shaderCost` and `overdraw` screenshots differ
