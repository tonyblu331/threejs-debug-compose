# threejs-debug-compose

[![npm version](https://img.shields.io/npm/v/threejs-debug-compose.svg)](https://www.npmjs.com/package/threejs-debug-compose)
[![license](https://img.shields.io/npm/l/threejs-debug-compose.svg)](./LICENSE)
[![bundle size](https://img.shields.io/bundlephobia/minzip/threejs-debug-compose.svg)](https://bundlephobia.com/package/threejs-debug-compose)

Composable TSL debug views for a Three.js WebGPU render pipeline.

The demo renders the scene into compact WebGPU MRT passes, exposes Beauty/Normal/Depth plus packed material buffers, and composites them through a fullscreen `RenderPipeline`.

![threejs-debug-compose composed viewport banner](https://cdn.jsdelivr.net/npm/threejs-debug-compose@0.1.1/assets/readme-compose-banner.png)

## Quick Start

```tsx
import { DebugViews } from "threejs-debug-compose/react"

<DebugViews
  views={[
    { label: "Beauty", source: "beauty", mode: "passthrough" },
    { label: "Normal", source: "normal", mode: "passthrough" },
    { label: "Depth", source: "depth", mode: "depth" },
    { label: "Base Color / Albedo", source: "albedo", mode: "passthrough" },
  ]}
  layout="single"
  activeView={0}
/>
```

## Built-in Views

| Mode | Source | Output |
|------|--------|--------|
| `passthrough` | scene color output | beauty pass |
| `passthrough` | 8-bit encoded `normalView` MRT output | RGB normal visualization |
| `passthrough` | 8-bit encoded material detail MRT | material normal / normal-map visualization |
| `depth` | pass depth texture converted to view-space distance | inverted grayscale |
| `passthrough` | packed material MRT | base color/albedo, roughness, AO, metallic, opacity |
| `passthrough` | material detail MRT | emissive color |
| `passthrough` | wireframe override pass | white wireframe |
| `passthrough` | neutral material override pass | lighting-only visualization |
| `passthrough` | reflective neutral material override pass | reflection-only visualization |
| `heatmap` | bucketed shader-complexity override pass | estimated shader complexity heatmap |

The material data is packed into one RGBA target:

- `R`: roughness
- `G`: metallic
- `B`: AO
- `A`: opacity

This keeps the composer under the common WebGPU `maxColorAttachmentBytesPerSample` limit instead of allocating one render target per scalar debug view.

Emissive and material-normal/normal-map views use a second small MRT pass. That keeps the main pass below the attachment byte budget while preserving both geometry normals and material-perturbed normals. Lighting-only, reflection-only, estimated shader-complexity, and wireframe use demand-driven override passes, so they add GPU work only when selected by the active layout or viewport plan.

### Estimated Shader Complexity

The `shaderCost` view provides a highly optimized, declarative estimation of shader workload without expensive runtime shader parsing. It evaluates:
- **Lighting Model Tier**: Unlit < Per-Vertex < Per-Pixel < PBR < Advanced PBR.
- **Texture Overhead**: Weights based on texture type (e.g., `normalMap` costs more than `aoMap`) and resolution (4K > 1024px > 256px).
- **Pipeline Breakers**: Penalties for `alphaTest`, `transparent`, and `clippingPlanes`.
- **Advanced Optics**: Additional weight for `transmission`, `clearcoat`, `iridescence`, and `sheen`.
- **Custom Shaders**: Infers complexity via uniform count for `ShaderMaterial` instances.

This approach guarantees zero regex overhead, bounded memory usage (LRU cache), and immediate early exits for cheap materials, making it safe for real-time debug overlays.

## Render Modes

`DebugViews` supports two public modes:

- `compose` - default/current path. One TSL fullscreen compositor presents single, overlay, split, row, column, and grid layouts.
- `viewport` - explicit viewport-assignment path. `viewportViews` defines the panes to present; the internal render-graph plan dedupes repeated pass construction and presents cells with renderer viewport/scissor bounds.

```tsx
<DebugViews
  mode="viewport"
  views={views}
  viewportViews={[
    { view: "beauty", label: "Beauty" },
    { view: "lightingOnly", label: "Lighting" },
    { view: "normal", label: "Normals", resolutionScale: 0.5 },
    { view: "roughness", label: "Roughness", resolutionScale: 0.5 },
  ]}
  layout="row"
  slots={4}
  showLabels
/>
```

Use `compose` for cheap compositing and overlays. Use `viewport` when callers need stable pane assignments, labels, per-pane resolution policy, or scissor-based presentation. `resolutionScale` is quantized to `1`, `0.5`, or `0.25` so render targets can be pooled predictably instead of producing one-off VRAM allocations.

## Layouts

- `single` - one view at a time (switch with `activeView`)
- `split-h` - left/right split by view index
- `split-v` - top/bottom split by view index
- `quad` - 2x2 grid; empty cells repeat the beauty view
- `row` - N views side by side with `slots`
- `column` - N stacked views with `slots`
- `grid` - explicit `columns` x `rows` topology
- `overlay` - alpha blend views over the beauty pass

```tsx
<DebugViews views={views} layout="row" slots={4} />
<DebugViews views={views} layout="row" slots={3} />
<DebugViews views={views} layout="grid" columns={4} rows={1} />
```

The render plan still selects only the visible slot budget, so a four-wide row does not force every registered debug source to allocate.

## Viewport Labels

Enable labels to identify each viewport in split, row, column, or grid layouts:

```tsx
<DebugViews
  views={views}
  layout="row"
  slots={4}
  showLabels
  viewportLabels={["Beauty", "Normals", "Depth", "Albedo"]}
/>
```

## Custom TSL Nodes

You can provide a custom node per view. If omitted, the component resolves a built-in source node from the scene pass.

```tsx
import { float, vec4 } from "three/tsl"

{ label: "Constant", node: float(0.5), mode: "depth", scale: 1 }
{ label: "Custom Color", node: vec4(1, 0, 0, 1), mode: "passthrough" }
```

## Leva Controls

Interactive GUI for switching views at runtime:

```tsx
import { useDebugViewsControls } from "threejs-debug-compose/react"

const controls = useDebugViewsControls({
  viewLabels: ["Beauty", "Normal", "Depth", "Base Color / Albedo"],
})
```

## Verification

```bash
pnpm verify
```

For runtime-facing WebGPU changes, also smoke-test the Vite demo in a browser with WebGPU support:

```bash
pnpm dev
```

## Project Shape

- `components/debug-views/` is the package source.
- `threejs-debug-compose` exports core helpers, planning utilities, TSL compositor helpers, and public types.
- `threejs-debug-compose/react` exports the React/R3F runtime component and Leva controls.
- `src/` is the local demo app, not package source.
- `packages/docs/` is the Astro documentation site.


### Stable Custom Debug Views

For custom shader/debug nodes that may be recreated between React renders, prefer `createCustomDebugView` with a stable `id`:

```tsx
import { float, vec4 } from "three/tsl"
import { createCustomDebugView, DEFAULT_DEBUG_VIEWS } from "threejs-debug-compose"
import { DebugViews } from "threejs-debug-compose/react"

const fresnelView = createCustomDebugView({
  id: "shader:fresnel",
  label: "Fresnel",
  node: vec4(float(1), float(0), float(0), float(1)),
})

<DebugViews views={[...DEFAULT_DEBUG_VIEWS, fresnelView]} />
```

The viewport render graph uses the stable `id` to dedupe equivalent custom node views. If the custom debug output needs its own render target, material override, or disposal lifecycle, model it as a dedicated pass provider instead of forcing it into a compositor-only node.
