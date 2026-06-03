import { UnsignedByteType, type Texture, type TextureDataType } from "three"
import type { DebugView, DebugViewSource } from "./debug-views-tsl/compositor"
import type {
  MaterialDebugChannels,
  MaterialDetailOutputs,
  SceneDebugOutputs,
} from "./debug-views-tsl/default-debug-nodes"
import type { DebugViewLayout, ResolvedDebugViewLayout } from "./debug-view-layout"
import { getDefaultDebugViewSource, selectPipelineViews } from "./debug-view-selection"

export interface DebugTextureTypeOverride {
  name: string
  type: TextureDataType
}

export interface TextureTypedDebugPass {
  getTexture(name: string): Texture
}

export interface DebugRenderPlan {
  views: DebugView[]
  sceneOutputs: SceneDebugOutputs
  materialDetailOutputs: MaterialDetailOutputs
  usesMaterialDetailPass: boolean
  usesWireframePass: boolean
  usesLightingOnlyPass: boolean
  usesReflectionOnlyPass: boolean
  usesShaderCostPass: boolean
  usesAoFallback: boolean
  sceneTextureTypes: DebugTextureTypeOverride[]
  materialDetailTextureTypes: DebugTextureTypeOverride[]
}

export function createDebugRenderPlan(
  views: readonly DebugView[],
  activeView: number,
  layout: DebugViewLayout | ResolvedDebugViewLayout,
): DebugRenderPlan {
  const selectedViews = selectPipelineViews(views, activeView, layout)
  const sceneOutputs = getSceneDebugOutputs(selectedViews)
  const materialDetailOutputs = getMaterialDetailOutputs(selectedViews)

  return {
    views: selectedViews,
    sceneOutputs,
    materialDetailOutputs,
    usesMaterialDetailPass: hasMaterialDetailOutputs(materialDetailOutputs),
    usesWireframePass: usesDefaultSource(selectedViews, "wireframe"),
    usesLightingOnlyPass: usesDefaultSource(selectedViews, "lightingOnly"),
    usesReflectionOnlyPass: usesDefaultSource(selectedViews, "reflectionOnly"),
    usesShaderCostPass: usesDefaultSource(selectedViews, "shaderCost"),
    usesAoFallback: usesDefaultSource(selectedViews, "ao"),
    sceneTextureTypes: getSceneTextureTypes(sceneOutputs),
    materialDetailTextureTypes: getMaterialDetailTextureTypes(materialDetailOutputs),
  }
}

export function applyDebugTextureTypes(
  passNode: TextureTypedDebugPass,
  overrides: readonly DebugTextureTypeOverride[],
) {
  for (const override of overrides) {
    passNode.getTexture(override.name).type = override.type
  }
}

function getSceneDebugOutputs(views: readonly DebugView[]): SceneDebugOutputs {
  const outputs: SceneDebugOutputs = {}
  const material: MaterialDebugChannels = {}

  for (const view of views) {
    if (view.node) continue

    switch (getDefaultDebugViewSource(view)) {
      case "normal":
        outputs.normal = true
        break
      case "albedo":
      case "baseColor":
        outputs.albedo = true
        break
      case "roughness":
        material.roughness = true
        break
      case "metalness":
      case "metallic":
        material.metalness = true
        break
      case "ao":
        material.ao = true
        break
      case "opacity":
      case "transparency":
        material.opacity = true
        break
    }
  }

  if (hasMaterialChannels(material)) {
    outputs.material = material
  }

  return outputs
}

function getMaterialDetailOutputs(views: readonly DebugView[]): MaterialDetailOutputs {
  const outputs: MaterialDetailOutputs = {}

  for (const view of views) {
    if (view.node) continue

    switch (getDefaultDebugViewSource(view)) {
      case "materialNormal":
      case "normalMap":
        outputs.materialNormal = true
        break
      case "emissive":
        outputs.emissive = true
        break
    }
  }

  return outputs
}

function getSceneTextureTypes(outputs: SceneDebugOutputs): DebugTextureTypeOverride[] {
  const overrides: DebugTextureTypeOverride[] = []

  if (outputs.normal) overrides.push(lowPrecision("normal"))
  if (outputs.albedo) overrides.push(lowPrecision("albedo"))
  if (outputs.material) overrides.push(lowPrecision("material"))

  return overrides
}

function getMaterialDetailTextureTypes(
  outputs: MaterialDetailOutputs,
): DebugTextureTypeOverride[] {
  return outputs.materialNormal ? [lowPrecision("materialNormal")] : []
}

function lowPrecision(name: string): DebugTextureTypeOverride {
  return { name, type: UnsignedByteType }
}

function usesDefaultSource(views: readonly DebugView[], source: DebugViewSource) {
  return views.some((view) => !view.node && getDefaultDebugViewSource(view) === source)
}

function hasMaterialChannels(channels: MaterialDebugChannels) {
  return Boolean(
    channels.roughness ||
    channels.metalness ||
    channels.ao ||
    channels.opacity
  )
}

function hasMaterialDetailOutputs(outputs: MaterialDetailOutputs) {
  return Boolean(outputs.materialNormal || outputs.emissive)
}
