import {
  Color,
  Material,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  type Texture,
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
type CoverageMaterialCache = Map<string, MeshBasicMaterial>

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
  const coverageMaterials: CoverageMaterialCache = new Map()

  return {
    apply(scene) {
      return applyShaderCostOverride(scene, materials, cache, coverageMaterials)
    },
    dispose() {
      for (const material of materials) {
        material.dispose()
      }
      for (const material of coverageMaterials.values()) {
        material.dispose()
      }
      coverageMaterials.clear()
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
  coverageMaterials: CoverageMaterialCache,
): ShaderCostRestore {
  const originals: OriginalMaterialEntry[] = []

  scene.traverse((object) => {
    if (!isMeshWithMaterial(object)) return

    originals.push({
      mesh: object,
      material: object.material,
    })

    object.material = replaceMaterial(object.material, bucketMaterials, cache, coverageMaterials)
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
  coverageMaterials: CoverageMaterialCache,
): MeshMaterial {
  if (Array.isArray(material)) {
    return material.map((entry) => getBucketMaterial(entry, bucketMaterials, cache, coverageMaterials))
  }

  return getBucketMaterial(material, bucketMaterials, cache, coverageMaterials)
}

function getBucketMaterial(
  material: Material,
  bucketMaterials: readonly MeshBasicMaterial[],
  cache: MaterialCostCache,
  coverageMaterials: CoverageMaterialCache,
) {
  const bucket = getShaderCostBucketIndex(cache.get(material).cost, bucketMaterials.length)
  if (canUseSharedBucketMaterial(material)) {
    return bucketMaterials[bucket]
  }

  const key = createCoverageMaterialKey(material, bucket)
  const existing = coverageMaterials.get(key)
  if (existing) return existing

  const color = bucketMaterials[bucket].color.clone()
  const alphaMap = getMaterialProperty<Texture | null>(material, "alphaMap")
  const alphaTest = Math.max(getMaterialAlphaTest(material), alphaMap ? 0.001 : 0)
  const coverageMaterial = new MeshBasicMaterial({
    alphaMap,
    alphaTest,
    blending: material.blending,
    color,
    depthTest: material.depthTest,
    depthWrite: getMaterialDepthWrite(material),
    name: `ShaderCostBucket:${bucket}:coverage`,
    opacity: 1,
    side: material.side,
    toneMapped: false,
    transparent: false,
  })

  coverageMaterial.alphaHash = getMaterialProperty(material, "alphaHash") === true
  coverageMaterials.set(key, coverageMaterial)
  return coverageMaterial
}

function canUseSharedBucketMaterial(material: Material) {
  return (
    !material.transparent &&
    getMaterialOpacity(material) >= 1 &&
    getMaterialAlphaTest(material) <= 0 &&
    getMaterialProperty(material, "alphaMap") == null &&
    getMaterialProperty(material, "alphaHash") !== true &&
    getMaterialDepthWrite(material)
  )
}

function createCoverageMaterialKey(material: Material, bucket: number) {
  const alphaMap = getMaterialProperty<Texture | null>(material, "alphaMap")
  const alphaHash = getMaterialProperty(material, "alphaHash") === true ? "H" : "-"
  const textureId = alphaMap ? alphaMap.uuid : "-"

  return [
    bucket,
    textureId,
    getMaterialAlphaTest(material),
    getMaterialOpacity(material),
    material.transparent ? "T" : "-",
    alphaHash,
    material.side,
    material.depthTest ? "DT" : "-",
    getMaterialDepthWrite(material) ? "DW" : "-",
    material.blending,
  ].join(":")
}

function getMaterialOpacity(material: Material) {
  return typeof material.opacity === "number" ? material.opacity : 1
}

function getMaterialAlphaTest(material: Material) {
  return typeof material.alphaTest === "number" ? material.alphaTest : 0
}

function getMaterialDepthWrite(material: Material) {
  return typeof material.depthWrite === "boolean" ? material.depthWrite : true
}

function getMaterialProperty<T>(material: Material, property: string): T | undefined {
  return (material as unknown as Record<string, T>)[property]
}

function isMeshWithMaterial(object: Object3D): object is Mesh {
  return Boolean((object as Mesh).isMesh && (object as Mesh).material)
}

function normalizeBucketCount(bucketCount = DEFAULT_SHADER_COST_BUCKET_COUNT) {
  return Math.max(2, Math.floor(bucketCount))
}
