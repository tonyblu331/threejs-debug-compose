import { describe, expect, it } from "vitest"
import {
  AdditiveBlending,
  BoxGeometry,
  DataTexture,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  RGBAFormat,
  Scene,
  UnsignedByteType,
} from "three"
import { createOverdrawOverride } from "./overdraw-override"

describe("overdraw material override", () => {
  it("hides opaque materials and restores originals", () => {
    const scene = new Scene()
    const geometry = new BoxGeometry()
    const material = new MeshStandardMaterial()
    const mesh = new Mesh(geometry, material)
    const override = createOverdrawOverride()

    scene.add(mesh)

    const restore = override.apply(scene)

    expect(restore.replacements).toBe(1)
    expect(mesh.visible).toBe(false)

    restore.restore()
    restore.restore()

    expect(mesh.material).toBe(material)
    expect(mesh.visible).toBe(true)

    override.dispose()
  })

  it("uses additive transparent replacement materials for transparent contributors", () => {
    const scene = new Scene()
    const geometry = new BoxGeometry()
    const material = new MeshStandardMaterial({ transparent: true, opacity: 0.5 })
    const mesh = new Mesh(geometry, material)
    const override = createOverdrawOverride()

    scene.add(mesh)

    const restore = override.apply(scene)
    const replacement = mesh.material as unknown as MeshBasicMaterial

    expect(mesh.visible).toBe(true)
    expect(replacement).not.toBe(material)
    expect(replacement.blending).toBe(AdditiveBlending)
    expect(replacement.depthTest).toBe(false)
    expect(replacement.depthWrite).toBe(false)
    expect(replacement.opacity).toBeGreaterThan(0)
    expect(replacement.transparent).toBe(true)

    restore.restore()
    override.dispose()
  })

  it("preserves alpha coverage for foliage cards", () => {
    const scene = new Scene()
    const geometry = new BoxGeometry()
    const alphaMap = new DataTexture(new Uint8Array([255, 255, 255, 128]), 1, 1, RGBAFormat, UnsignedByteType)
    alphaMap.needsUpdate = true
    const material = new MeshStandardMaterial({
      alphaMap,
      alphaTest: 0.33,
      side: DoubleSide,
      transparent: true,
    })
    const mesh = new Mesh(geometry, material)
    const override = createOverdrawOverride()

    scene.add(mesh)

    const restore = override.apply(scene)
    const replacement = mesh.material as unknown as MeshBasicMaterial

    expect(replacement.alphaMap).toBe(alphaMap)
    expect(replacement.alphaTest).toBe(0.33)
    expect(replacement.side).toBe(DoubleSide)

    restore.restore()
    override.dispose()
  })
})
