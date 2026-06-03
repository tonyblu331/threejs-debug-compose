import {
  Color,
  Material,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  type Scene,
} from "three"
import { createMaterialCostCache, type MaterialCostCache } from "./material-cost"

export const DEFAULT_SHADER_COST_BUCKET_COUNT = 16

export interface ShaderCostOverrideOptions {
  bucketCount?: number
  cache?: MaterialCostCache
}

export interface ShaderCostOverride {
  apply(scene: Scene | Object3D): ShaderCostRestore
  dispose(): void
  readonly bucketCount: number
  readonly materials: readonly MeshBasicMaterial[]
}

export interface ShaderCostRestore {
  restore(): void
  readonly replacements: number
}

type MeshMaterial = Material | Material[]

interface OriginalMaterialEntry {
  mesh: Mesh
  material: MeshMaterial
}

export function createShaderCostOverride(
  options: ShaderCostOverrideOptions = {},
): ShaderCostOverride {
  const bucketCount = normalizeBucketCount(options.bucketCount)
  const cache = options.cache ?? createMaterialCostCache()
  const materials = createShaderCostBucketMaterials(bucketCount)

  return {
    apply(scene) {
      return applyShaderCostOverride(scene, materials, cache)
    },
    dispose() {
      for (const material of materials) {
        material.dispose()
      }
    },
    bucketCount,
    materials,
  }
}

export function createShaderCostBucketMaterials(
  bucketCount = DEFAULT_SHADER_COST_BUCKET_COUNT,
): MeshBasicMaterial[] {
  const normalizedBucketCount = normalizeBucketCount(bucketCount)

  return Array.from({ length: normalizedBucketCount }, (_, index) => {
    const cost = index / (normalizedBucketCount - 1)
    const color = new Color(cost, cost, cost)

    return new MeshBasicMaterial({
      color,
      depthTest: true,
      depthWrite: true,
      name: `ShaderCostBucket:${index}`,
      toneMapped: false,
    })
  })
}

export function getShaderCostBucketIndex(
  cost: number,
  bucketCount = DEFAULT_SHADER_COST_BUCKET_COUNT,
) {
  const normalizedBucketCount = normalizeBucketCount(bucketCount)
  const normalizedCost = Math.max(0, Math.min(1, cost))

  return Math.round(normalizedCost * (normalizedBucketCount - 1))
}

function applyShaderCostOverride(
  scene: Scene | Object3D,
  bucketMaterials: readonly MeshBasicMaterial[],
  cache: MaterialCostCache,
): ShaderCostRestore {
  const originals: OriginalMaterialEntry[] = []

  scene.traverse((object) => {
    if (!isMeshWithMaterial(object)) return

    originals.push({
      mesh: object,
      material: object.material,
    })

    object.material = replaceMaterial(object.material, bucketMaterials, cache)
  })

  let restored = false

  return {
    restore() {
      if (restored) return

      for (const entry of originals) {
        entry.mesh.material = entry.material
      }

      restored = true
    },
    get replacements() {
      return originals.length
    },
  }
}

function replaceMaterial(
  material: MeshMaterial,
  bucketMaterials: readonly MeshBasicMaterial[],
  cache: MaterialCostCache,
): MeshMaterial {
  if (Array.isArray(material)) {
    return material.map((entry) => getBucketMaterial(entry, bucketMaterials, cache))
  }

  return getBucketMaterial(material, bucketMaterials, cache)
}

function getBucketMaterial(
  material: Material,
  bucketMaterials: readonly MeshBasicMaterial[],
  cache: MaterialCostCache,
) {
  const bucket = getShaderCostBucketIndex(cache.get(material).cost, bucketMaterials.length)
  return bucketMaterials[bucket]
}

function isMeshWithMaterial(object: Object3D): object is Mesh {
  return Boolean((object as Mesh).isMesh && (object as Mesh).material)
}

function normalizeBucketCount(bucketCount = DEFAULT_SHADER_COST_BUCKET_COUNT) {
  return Math.max(2, Math.floor(bucketCount))
}
