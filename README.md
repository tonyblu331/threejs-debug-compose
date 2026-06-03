# threejs-debug-compose

[![npm version](https://img.shields.io/npm/v/threejs-debug-compose.svg)](https://www.npmjs.com/package/threejs-debug-compose)
[![license](https://img.shields.io/npm/l/threejs-debug-compose.svg)](./LICENSE)
[![bundle size](https://img.shields.io/bundlephobia/minzip/threejs-debug-compose.svg)](https://bundlephobia.com/package/threejs-debug-compose)

Small debug views for Three.js WebGPU + TSL render pipelines.

It lets you inspect what your scene is producing while you build: beauty, normals, depth, material channels, override views, and estimated shader complexity. It is focused on WebGPU debugging, not on being a full scene inspector.

![threejs-debug-compose composed viewport banner](https://cdn.jsdelivr.net/npm/threejs-debug-compose@0.1.1/assets/readme-compose-banner.png)

## Status

- WebGPU-first.
- TSL-first.
- React/R3F runtime component.
- No WebGL fallback right now.
- Not an `EffectComposer` helper.

The current runtime uses `three/webgpu`, `three/tsl`, WebGPU MRT passes, and a fullscreen `RenderPipeline`. If your app is still on WebGL, this package is not the fallback path yet.

## Install

```bash
pnpm add threejs-debug-compose
```

`three`, `react`, `@react-three/fiber`, `@react-three/drei`, and `leva` are peer dependencies for the React runtime.

## Quick Start

```tsx
import { DebugViews, useDebugViewsControls } from "threejs-debug-compose/react"
import { DEFAULT_DEBUG_VIEWS, getDebugViewLabels } from "threejs-debug-compose"

function DebugLayer() {
  const controls = useDebugViewsControls({
    viewLabels: getDebugViewLabels(DEFAULT_DEBUG_VIEWS),
  })

  return <DebugViews views={DEFAULT_DEBUG_VIEWS} {...controls} />
}
```

Or define only the views you need:

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

## What It Shows

Built-in debug sources:

- Beauty
- Normal
- Depth
- Base Color / Albedo
- Material Normal / Normal Map
- Emissive
- Roughness
- AO
- Metallic
- Opacity
- Wireframe
- Lighting Only
- Reflection Only
- Estimated Shader Complexity

Material scalars are packed into one RGBA target:

- `R`: roughness
- `G`: metallic
- `B`: AO
- `A`: opacity

That avoids creating one render target per scalar view. Material-normal and emissive use a second material-detail pass. Wireframe, lighting-only, reflection-only, and shader-cost views are created only when the active layout needs them.

`shaderCost` is an estimate, not a native GPU instruction counter. It buckets materials from runtime material signals such as material type, texture slots, texture resolution, transparency, alpha test, clipping, physical-material features, and custom shader uniform count.

## Render Modes

`DebugViews` has two modes:

- `compose`: one fullscreen TSL output for single, overlay, split, row, column, and grid layouts.
- `viewport`: explicit viewport assignment with labels, per-pane resolution scale, and scissor-based presentation.

```tsx
<DebugViews
  mode="viewport"
  views={DEFAULT_DEBUG_VIEWS}
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

`resolutionScale` is quantized to `1`, `0.5`, or `0.25` so render targets stay predictable instead of creating one-off sizes.

## Layouts

- `single`: one view at a time.
- `overlay`: blends the active view over beauty.
- `split-h`: left/right split.
- `split-v`: top/bottom split.
- `quad`: 2x2 grid.
- `row`: N views side by side.
- `column`: N stacked views.
- `grid`: explicit `columns` x `rows` layout.

```tsx
<DebugViews views={DEFAULT_DEBUG_VIEWS} layout="row" slots={4} showLabels />
<DebugViews views={DEFAULT_DEBUG_VIEWS} layout="grid" columns={4} rows={1} showLabels />
```

The render plan selects only the visible slot budget. A four-wide row does not force every registered debug view to allocate.

## Custom TSL Views

You can pass a custom TSL node as a debug view:

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

Use a stable `id` when a custom node can be recreated between React renders. The viewport render graph uses that id to dedupe equivalent custom views.

If a custom debug output needs its own render target, material override, or disposal lifecycle, model it as a dedicated pass provider instead of forcing it into a compositor-only node.

## Project Shape

- `components/debug-views/` is the package source.
- `threejs-debug-compose` exports debug view definitions, planning utilities, TSL helpers, and public types.
- `threejs-debug-compose/react` exports the R3F `DebugViews` component and Leva controls.
- `src/` is the local demo app.
- `packages/docs/` is the Astro documentation site.

## Verification

```bash
pnpm verify
```

For runtime-facing WebGPU changes, also smoke-test the Vite demo in a browser with WebGPU support:

```bash
pnpm dev
```
