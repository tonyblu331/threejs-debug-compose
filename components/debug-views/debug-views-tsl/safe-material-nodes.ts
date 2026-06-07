import {
  Fn,
  float,
  materialAO,
  materialEmissive,
  materialMetalness,
  materialReference,
  materialRoughness,
  vec3,
} from "three/tsl"
import type { Color, Material, Texture } from "three"
import type { FloatNode, Vec3Node } from "./node-types"

interface MaterialRecord extends Material {
  aoMap?: Texture | null
  aoMapIntensity?: number
  emissive?: Color
  emissiveIntensity?: number
  emissiveMap?: Texture | null
  metalness?: number
  metalnessMap?: Texture | null
  roughness?: number
  roughnessMap?: Texture | null
}

export const safeMaterialRoughness = typedNode<FloatNode>(
  Fn((builder: unknown) => {
    const material = getBuilderMaterial(builder)
    return material?.roughness === undefined ? float(1) : materialRoughness
  }, "float")(),
)

export const safeMaterialMetalness = typedNode<FloatNode>(
  Fn((builder: unknown) => {
    const material = getBuilderMaterial(builder)
    return material?.metalness === undefined ? float(0) : materialMetalness
  }, "float")(),
)

export const safeMaterialAO = typedNode<FloatNode>(
  Fn((builder: unknown) => {
    const material = getBuilderMaterial(builder)

    if (material?.aoMap?.isTexture !== true) {
      return float(1)
    }

    const aoMap = typedNode<Vec3Node>(materialReference("aoMap", "texture")).r
    const intensity = material.aoMapIntensity === undefined
      ? float(1)
      : typedNode<FloatNode>(materialReference("aoMapIntensity", "float"))

    return aoMap.sub(1).mul(intensity).add(1)
  }, "float")(),
)

export const safeMaterialEmissive = typedNode<Vec3Node>(
  Fn((builder: unknown) => {
    const material = getBuilderMaterial(builder)
    return material?.emissive === undefined ? vec3(0) : materialEmissive
  }, "vec3")(),
)

function getBuilderMaterial(builder: unknown) {
  return (builder as { context?: { material?: MaterialRecord } }).context?.material
}

function typedNode<TNode>(node: unknown): TNode {
  return node as TNode
}
