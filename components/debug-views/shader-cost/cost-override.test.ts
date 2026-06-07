import { describe, expect, it } from "vitest"
import {
  BoxGeometry,
  DataTexture,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  RGBAFormat,
  Scene,
  UnsignedByteType,
} from "three"
import {
  createShaderCostBucketMaterials,
  createShaderCostOverride,
  getShaderCostBucketIndex,
} from "./cost-override"
import { scoreMaterialCost } from "./material-cost"

describe("shader cost material override", () => {
  it("maps normalized costs into stable bucket indices", () => {
    expect(getShaderCostBucketIndex(-1, 4)).toBe(0)
    expect(getShaderCostBucketIndex(0, 4)).toBe(0)
    expect(getShaderCostBucketIndex(0.5, 4)).toBe(2)
    expect(getShaderCostBucketIndex(1, 4)).toBe(3)
    expect(getShaderCostBucketIndex(2, 4)).toBe(3)
  })

  it("creates a bounded bucket material set", () => {
    const materials = createShaderCostBucketMaterials(4)

    expect(materials).toHaveLength(4)
    expect(materials.map((material) => material.name)).toEqual([
      "ShaderCostBucket:0",
      "ShaderCostBucket:1",
      "ShaderCostBucket:2",
      "ShaderCostBucket:3",
    ])
    expect(materials.every((material) => material.toneMapped === false)).toBe(true)
  })

  it("replaces scene mesh materials with bucketed materials and restores originals", () => {
    const scene = new Scene()
    const geometry = new BoxGeometry()
    const cheap = new MeshBasicMaterial()
    const medium = new MeshStandardMaterial()
    const expensive = new MeshPhysicalMaterial({ transparent: true })
    const cheapMesh = new Mesh(geometry, cheap)
    const mediumMesh = new Mesh(geometry, medium)
    const expensiveMesh = new Mesh(geometry, expensive)
    const override = createShaderCostOverride({ bucketCount: 4 })

    scene.add(cheapMesh, mediumMesh, expensiveMesh)

    const restore = override.apply(scene)

    expect(restore.replacements).toBe(3)
    expect(override.materials).toContain(cheapMesh.material)
    expect(override.materials).toContain(mediumMesh.material)
    expect(override.materials).not.toContain(expensiveMesh.material)
    expect((expensiveMesh.material as unknown as MeshBasicMaterial).opacity).toBe(1)
    expect((expensiveMesh.material as unknown as MeshBasicMaterial).transparent).toBe(false)
    expect(new Set([cheapMesh.material, mediumMesh.material, expensiveMesh.material]).size)
      .toBeLessThanOrEqual(override.bucketCount)

    restore.restore()
    restore.restore()

    expect(cheapMesh.material).toBe(cheap)
    expect(mediumMesh.material).toBe(medium)
    expect(expensiveMesh.material).toBe(expensive)

    override.dispose()
  })

  it("preserves multi-material mesh slots through restore", () => {
    const scene = new Scene()
    const geometry = new BoxGeometry()
    const materials = [new MeshBasicMaterial(), new MeshStandardMaterial()]
    const mesh = new Mesh(geometry, materials)
    const override = createShaderCostOverride({ bucketCount: 4 })

    scene.add(mesh)

    const restore = override.apply(scene)

    expect(Array.isArray(mesh.material)).toBe(true)
    expect(mesh.material).not.toBe(materials)
    expect(mesh.material as MeshBasicMaterial[]).toHaveLength(2)

    restore.restore()

    expect(mesh.material).toBe(materials)

    override.dispose()
  })

  it("preserves alpha coverage state for shader cost replacements", () => {
    const scene = new Scene()
    const geometry = new BoxGeometry()
    const alphaMap = new DataTexture(new Uint8Array([255, 255, 255, 128]), 1, 1, RGBAFormat, UnsignedByteType)
    alphaMap.needsUpdate = true
    const material = new MeshStandardMaterial({
      alphaMap,
      alphaTest: 0.42,
      depthWrite: false,
      opacity: 0.7,
      side: DoubleSide,
      transparent: true,
    })
    const mesh = new Mesh(geometry, material)
    const override = createShaderCostOverride({ bucketCount: 4 })

    scene.add(mesh)

    const restore = override.apply(scene)
    const replacement = mesh.material as unknown as MeshBasicMaterial

    expect(replacement).not.toBe(material)
    expect(replacement).not.toBe(override.materials[0])
    expect(replacement.alphaMap).toBe(alphaMap)
    expect(replacement.alphaTest).toBe(0.42)
    expect(replacement.depthWrite).toBe(false)
    expect(replacement.opacity).toBe(1)
    expect(replacement.side).toBe(DoubleSide)
    expect(replacement.transparent).toBe(false)

    restore.restore()

    expect(mesh.material).toBe(material)

    override.dispose()
  })

  it("keeps bucket mapping absolute instead of normalizing every scene to white", () => {
    const scene = new Scene()
    const geometry = new BoxGeometry()
    const material = new MeshBasicMaterial()
    const mesh = new Mesh(geometry, material)
    const override = createShaderCostOverride({ bucketCount: 4 })

    scene.add(mesh)

    const restore = override.apply(scene)

    expect(mesh.material).not.toBe(override.materials[override.bucketCount - 1])

    restore.restore()
    override.dispose()
  })

  it("preserves canonical material differences at bucket level", () => {
    const bucketCount = 16
    const basic = getShaderCostBucketIndex(
      scoreMaterialCost(new MeshBasicMaterial()),
      bucketCount,
    )
    const standard = getShaderCostBucketIndex(
      scoreMaterialCost(new MeshStandardMaterial()),
      bucketCount,
    )
    const physical = getShaderCostBucketIndex(
      scoreMaterialCost(new MeshPhysicalMaterial()),
      bucketCount,
    )

    expect(basic).toBeLessThan(standard)
    expect(standard).toBeLessThan(physical)
  })
})
